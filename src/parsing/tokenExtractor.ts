import { ParsedTurn } from './jsonlParser';
import { generateTurnId, insertTurn } from '../data/repositories/turnRepo';
import { getCurrentWindow, incrementWindowCounters } from '../data/repositories/windowRepo';
import { upsertSession } from '../data/repositories/sessionRepo';
import { isPeak } from '../domain/peakHourSchedule';
import { logger } from '../utils/logger';

/** Process a parsed turn: store in DB, update window counters */
export function processTurn(turn: ParsedTurn, projectPath: string | null): boolean {
  const turnId = generateTurnId(
    turn.sessionId,
    turn.timestamp,
    turn.inputTokens,
    turn.outputTokens
  );

  const peak = isPeak(new Date(turn.timestamp));

  // Insert turn (idempotent via content-addressed ID — ADR 0017)
  const isNew = insertTurn({
    turn_id: turnId,
    session_id: turn.sessionId,
    request_id: turn.requestId,
    timestamp: turn.timestamp,
    model: turn.model,
    input_tokens: turn.inputTokens,
    output_tokens: turn.outputTokens,
    cache_creation_input_tokens: turn.cacheCreationInputTokens,
    cache_read_input_tokens: turn.cacheReadInputTokens,
    cache_5m_tokens: turn.cache5mTokens,
    cache_1h_tokens: turn.cache1hTokens,
    is_peak: peak ? 1 : 0,
    stop_reason: turn.stopReason,
  });

  if (!isNew) {
    // Duplicate turn — already processed (idempotent)
    return false;
  }

  // Update window counters (atomic increment — ADR 0018)
  const currentWindow = getCurrentWindow();
  if (currentWindow) {
    incrementWindowCounters(
      currentWindow.window_id,
      peak,
      turn.inputTokens,
      turn.outputTokens,
      turn.cacheCreationInputTokens,
      turn.cacheReadInputTokens
    );
  }

  // Update session record
  upsertSession(turn.sessionId, projectPath, turn.timestamp);

  logger.info(`Processed turn: ${turn.model} in=${turn.inputTokens} out=${turn.outputTokens} peak=${peak}`);
  return true;
}
