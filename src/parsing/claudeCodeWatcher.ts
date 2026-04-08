import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseLines } from './jsonlParser';
import type { ParsedRateLimitEvent } from './jsonlParser';
import { processTurn } from './tokenExtractor';
import { resetLimitHitDetector } from './limitHitDetector';
import { insertLimitHit, getMostRecentLimitHitTimestamp } from '../data/repositories/limitHitRepo';
import { closeWindow, getCurrentWindow, openNewWindow } from '../data/repositories/windowRepo';
import { getSetting } from '../data/repositories/settingsRepo';
import { getWatcherState, setWatcherState } from '../data/repositories/watcherStateRepo';
import { beginBatch, endBatch } from '../data/db';
import pricingData from '../domain/pricing.json';
import { logger } from '../utils/logger';

const CLAUDE_PROJECTS_DIR = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '',
  '.claude',
  'projects'
);

export class ClaudeCodeWatcher {
  private watcher: vscode.FileSystemWatcher | null = null;
  private onDataUpdated: (() => void) | null = null;

  start(callback?: () => void): void {
    this.onDataUpdated = callback ?? null;

    if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
      logger.warn(`Claude projects directory not found: ${CLAUDE_PROJECTS_DIR}`);
      return;
    }

    // Watch for changes to .jsonl files in all project subdirectories
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(CLAUDE_PROJECTS_DIR),
      '**/*.jsonl'
    );

    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.watcher.onDidChange(uri => this.onFileChanged(uri));
    this.watcher.onDidCreate(uri => this.onFileChanged(uri));

    logger.info(`Watching ${CLAUDE_PROJECTS_DIR} for JSONL changes`);

    // Initial scan of existing files
    this.scanExistingFiles();
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = null;
    }
    resetLimitHitDetector();
    logger.info('Watcher stopped');
  }

  /** Re-scan all existing JSONL files from their current offsets (batched). */
  rescan(): void {
    beginBatch();
    try {
      this.scanExistingFiles();
    } finally {
      endBatch();
    }
  }

  private scanExistingFiles(): void {
    try {
      const projectDirs = fs.readdirSync(CLAUDE_PROJECTS_DIR);
      for (const dir of projectDirs) {
        const dirPath = path.join(CLAUDE_PROJECTS_DIR, dir);
        if (!fs.statSync(dirPath).isDirectory()) continue;

        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          if (!file.endsWith('.jsonl')) continue;
          const filePath = path.join(dirPath, file);
          this.processFile(filePath, dir);
        }
      }
    } catch (err) {
      logger.error('Error during initial scan', err);
    }
  }

  private onFileChanged(uri: vscode.Uri): void {
    const filePath = uri.fsPath;
    if (!filePath.endsWith('.jsonl')) return;

    // Extract project directory name from path
    const parts = filePath.split(path.sep);
    const projectsIdx = parts.indexOf('projects');
    const projectDir = projectsIdx >= 0 && projectsIdx + 1 < parts.length
      ? parts[projectsIdx + 1]
      : null;

    this.processFile(filePath, projectDir);
  }

  private processFile(filePath: string, projectDir: string | null): void {
    try {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;

      // Get saved offset
      const watcherState = getWatcherState(filePath);
      const offset = watcherState?.byte_offset ?? 0;

      if (offset >= fileSize) return; // No new data

      // Read new data from offset
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(fileSize - offset);
      fs.readSync(fd, buffer, 0, buffer.length, offset);
      fs.closeSync(fd);

      const newData = buffer.toString('utf-8');
      const { turns, rateLimitEvents } = parseLines(newData);

      let newTurnsProcessed = 0;
      for (const turn of turns) {
        const isNew = processTurn(turn, projectDir);
        if (isNew) {
          newTurnsProcessed++;
        }
      }

      // Process rate limit events with dedup
      for (const evt of rateLimitEvents) {
        this.handleRateLimitEvent(evt);
      }

      // Save offset
      setWatcherState(filePath, fileSize);

      if (newTurnsProcessed > 0) {
        logger.info(`Processed ${newTurnsProcessed} new turns from ${path.basename(filePath)}`);
        this.onDataUpdated?.();
      }
    } catch (err) {
      logger.error(`Error processing ${filePath}`, err);
    }
  }

  private handleRateLimitEvent(evt: ParsedRateLimitEvent): void {
    // Dedup: skip if a limit hit was already recorded within the plan's dedup window
    const planTier = getSetting('plan_tier') ?? 'pro';
    const tierConfig = (pricingData.plan_tiers as Record<string, { limit_hit_dedup_minutes: number }>)[planTier];
    const dedupMinutes = tierConfig?.limit_hit_dedup_minutes ?? 15;

    const lastHitTs = getMostRecentLimitHitTimestamp();
    if (lastHitTs) {
      const gapMs = new Date(evt.timestamp).getTime() - new Date(lastHitTs).getTime();
      if (Math.abs(gapMs) < dedupMinutes * 60_000) {
        return; // duplicate within dedup window
      }
    }

    const currentWindow = getCurrentWindow();
    if (currentWindow) {
      insertLimitHit({
        timestamp: evt.timestamp,
        window_id: currentWindow.window_id,
        detection_method: 'explicit_429',
        peak_input_tokens: currentWindow.peak_input_tokens,
        peak_output_tokens: currentWindow.peak_output_tokens,
        offpeak_input_tokens: currentWindow.offpeak_input_tokens,
        offpeak_output_tokens: currentWindow.offpeak_output_tokens,
        notes: evt.message,
      });
      closeWindow(currentWindow.window_id);
      openNewWindow();
      logger.info(`Rate limit detected at ${evt.timestamp}: ${evt.message}`);
      this.onDataUpdated?.();
    }
  }
}
