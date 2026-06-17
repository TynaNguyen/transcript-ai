/**
 * Scrolling transcript feed hiển thị real-time
 */
import type { LiveTranscriptLine } from '../hooks/useLiveRecording.js';
interface LiveTranscriptFeedProps {
    lines: LiveTranscriptLine[];
    speakerNames: Record<string, string>;
}
export default function LiveTranscriptFeed({ lines, speakerNames }: LiveTranscriptFeedProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=LiveTranscriptFeed.d.ts.map