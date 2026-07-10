import { contentService, Content } from './content.service';
import { audioCacheService } from './audioCache.service';

// The one content item whose audio is heavy enough that a cold, streamed first
// play on a weak connection is a noticeably bad experience (see
// .agents/memory/audio-playback-architecture.md — the "Internal Thoughts"
// recovery audio). Matched by title, same convention as the on-screen warm in
// TemptationDetails. If it's ever renamed in the CMS this simply stops matching
// (no error) — worth a periodic sanity check.
const ONBOARDING_HIGHLIGHT_TITLE = 'internal thoughts';

let prewarmStarted = false;

/**
 * Warm the onboarding highlight audio in the background so it's already cached
 * (and correctly extensioned for duration/seek) by the time the user reaches
 * it after onboarding — instead of a long cold stream on first play.
 *
 * Safe to call more than once: it self-guards so the content fetch runs at most
 * once per app session. `warmAudio` itself dedupes against the cache and
 * self-gates to unmetered connections, so on cellular this is a no-op and the
 * file simply streams on tap later. All failures are swallowed — this is a
 * pure optimization and must never block or break onboarding.
 */
export async function prewarmOnboardingHighlightAudio(): Promise<void> {
  if (prewarmStarted) {
    return;
  }
  prewarmStarted = true;

  try {
    const content = await contentService.getContent();
    const highlight = content.find(
      (item: Content) => item.title?.trim().toLowerCase() === ONBOARDING_HIGHLIGHT_TITLE
    );
    if (!highlight) {
      return;
    }

    const urls = [highlight.mainContentRecoveryURL, highlight.mainContentSupportURL];
    for (const url of urls) {
      if (url) {
        audioCacheService.warmAudio(url).catch(() => {});
      }
    }
  } catch {
    // Pre-warming is best-effort; never surface errors during onboarding.
    prewarmStarted = false; // allow a later retry (e.g. next onboarding screen mount)
  }
}
