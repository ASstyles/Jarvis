const EventEmitter = require('events');
const { speechSegmenter } = require('./speechSegmenter');

class ReadingSessionManager extends EventEmitter {
  constructor() {
    super();
    this.activeSession = null;
    this.sessionHistory = [];
  }

  /**
   * Create a new verifiable document reading session
   */
  createSession(extractedDoc) {
    const segments = speechSegmenter.segment(extractedDoc.text);
    const dateStr = new Date().toISOString().slice(0, 10);
    const seq = String(this.sessionHistory.length + 1).padStart(3, '0');
    const sessionId = `READ-${dateStr}-${seq}`;

    const session = {
      sessionId,
      documentId: extractedDoc.documentId || 'unnamed_doc',
      documentTitle: extractedDoc.title || 'Untitled Document',
      documentPath: extractedDoc.documentPath || '',
      fullText: extractedDoc.text,
      totalCharacters: extractedDoc.totalCharacters || extractedDoc.text.length,
      totalWords: extractedDoc.totalWords || (extractedDoc.text.match(/\S+/g) || []).length,
      totalSegments: segments.length,
      currentSegment: segments.length > 0 ? 1 : 0,
      completedSegments: 0,
      skippedSegments: 0,
      retryCount: 0,
      currentCharacterOffset: 0,
      currentWordOffset: 0,
      status: 'READY', // PREPARING, EXTRACTING, READY, READING, PAUSED, STOPPED, ERROR, VERIFYING, COMPLETED
      audioStarted: false,
      audioCompleted: false,
      interrupted: false,
      verified: false,
      confidence: extractedDoc.confidence || 1.0,
      segments,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.activeSession = session;
    this.sessionHistory.unshift(session);
    this.emit('SESSION_CREATED', session);
    return session;
  }

  getActiveSession() {
    return this.activeSession;
  }

  getSessionById(sessionId) {
    if (this.activeSession && this.activeSession.sessionId === sessionId) {
      return this.activeSession;
    }
    return this.sessionHistory.find(s => s.sessionId === sessionId) || null;
  }

  /**
   * Update lifecycle status of an individual segment during playback
   */
  updateSegmentStatus(segmentIndex, status, metadata = {}) {
    const session = this.activeSession;
    if (!session) return null;

    const segment = session.segments.find(s => s.index === segmentIndex);
    if (!segment) return null;

    segment.status = status;
    session.updatedAt = new Date().toISOString();

    if (status === 'PLAYING') {
      session.status = 'READING';
      session.audioStarted = true;
      session.currentSegment = segmentIndex;
      segment.audioStartedAt = Date.now();
      this.emit('SEGMENT_PLAYING', { sessionId: session.sessionId, segmentIndex, segment });
    } else if (status === 'COMPLETED') {
      segment.audioCompletedAt = Date.now();
      // Recount accurately to prevent duplicate increments
      session.completedSegments = session.segments.filter(s => s.status === 'COMPLETED').length;
      session.currentWordOffset += segment.wordCount;
      session.currentCharacterOffset = segment.endCharOffset;
      if (session.currentSegment === segmentIndex && segmentIndex < session.totalSegments) {
        session.currentSegment = segmentIndex + 1;
      }
      this.emit('SEGMENT_COMPLETED', { sessionId: session.sessionId, segmentIndex, segment });
    } else if (status === 'SKIPPED') {
      session.skippedSegments = session.segments.filter(s => s.status === 'SKIPPED').length;
      this.emit('SEGMENT_SKIPPED', { sessionId: session.sessionId, segmentIndex, segment });
    } else if (status === 'FAILED') {
      segment.retries = (segment.retries || 0) + 1;
      segment.error = metadata.error || 'TTS playback error';
      session.retryCount++;
      this.emit('SEGMENT_FAILED', { sessionId: session.sessionId, segmentIndex, segment });
    }

    this.emit('SESSION_UPDATED', session);
    return session;
  }

  pauseSession() {
    const session = this.activeSession;
    if (!session) return null;
    session.status = 'PAUSED';
    session.updatedAt = new Date().toISOString();
    this.emit('SESSION_PAUSED', session);
    return { status: 'PAUSED', spokenAcknowledgment: 'Paused.' };
  }

  resumeSession() {
    const session = this.activeSession;
    if (!session) return null;
    session.status = 'READING';
    session.updatedAt = new Date().toISOString();
    this.emit('SESSION_RESUMED', session);
    return { status: 'READING', spokenAcknowledgment: 'Continuing.' };
  }

  stopSession(reason = 'User stop directive') {
    const session = this.activeSession;
    if (!session) return null;
    session.status = 'STOPPED';
    session.interrupted = true;
    session.updatedAt = new Date().toISOString();
    this.emit('SESSION_STOPPED', { session, reason });
    return {
      status: 'STOPPED',
      spokenAcknowledgment: session.completedSegments > 0 
        ? `Stopped reading after section ${session.completedSegments} of ${session.totalSegments}.`
        : 'Stopped reading.'
    };
  }

  restartSession() {
    const session = this.activeSession;
    if (!session) return null;
    session.currentSegment = 1;
    session.completedSegments = 0;
    session.skippedSegments = 0;
    session.currentCharacterOffset = 0;
    session.currentWordOffset = 0;
    session.interrupted = false;
    session.verified = false;
    session.audioCompleted = false;
    session.status = 'READY';
    session.segments.forEach(s => {
      s.status = 'PENDING';
      s.retries = 0;
      delete s.audioStartedAt;
      delete s.audioCompletedAt;
    });
    session.updatedAt = new Date().toISOString();
    this.emit('SESSION_RESTARTED', session);
    return { status: 'READY', spokenAcknowledgment: 'Starting from the beginning.' };
  }

  skipSegment(targetIndex) {
    const session = this.activeSession;
    if (!session) return null;
    const current = session.currentSegment;
    const nextIdx = targetIndex || (current + 1);

    // Mark segments as skipped
    for (let idx = current; idx < nextIdx && idx <= session.totalSegments; idx++) {
      const seg = session.segments.find(s => s.index === idx);
      if (seg && seg.status !== 'COMPLETED') {
        seg.status = 'SKIPPED';
      }
    }
    session.skippedSegments = session.segments.filter(s => s.status === 'SKIPPED').length;

    if (nextIdx <= session.totalSegments) {
      session.currentSegment = nextIdx;
      session.status = 'READING';
      session.updatedAt = new Date().toISOString();
      this.emit('SESSION_SKIPPED', { session, nextSegment: nextIdx });
      return { status: 'READING', nextSegment: nextIdx, spokenAcknowledgment: 'Skipping to next section.' };
    } else {
      return this.verifySessionCompletion();
    }
  }

  /**
   * REAL COMPLETION VERIFICATION:
   * JARVIS must NEVER say "I read the complete letter" unless:
   * 1. audioStarted === true
   * 2. every segment was successfully played or explicitly skipped
   * 3. last segment playback completed
   * 4. reading session reached VERIFYING and verification succeeded
   */
  verifySessionCompletion() {
    const session = this.activeSession;
    if (!session) {
      return {
        verified: false,
        status: 'ERROR',
        message: 'No active reading session to verify.'
      };
    }

    session.status = 'VERIFYING';

    const allSegmentsAccountedFor = (session.completedSegments + session.skippedSegments) === session.totalSegments;
    const allSegmentsFinished = session.segments.every(s => s.status === 'COMPLETED' || s.status === 'SKIPPED');
    const reachedEnd = session.currentSegment >= session.totalSegments;

    const isVerified = (
      session.audioStarted === true &&
      allSegmentsAccountedFor &&
      allSegmentsFinished &&
      reachedEnd &&
      !session.interrupted &&
      session.totalSegments > 0
    );

    if (isVerified) {
      session.status = 'COMPLETED';
      session.audioCompleted = true;
      session.verified = true;
      session.updatedAt = new Date().toISOString();
      this.emit('SESSION_COMPLETED', session);
      return {
        verified: true,
        status: 'COMPLETED',
        message: "That's the end of the letter.",
        session
      };
    } else {
      session.verified = false;
      // Do not fake completion! State exact position
      const failureMessage = session.interrupted
        ? `I was stopped after section ${session.completedSegments} of ${session.totalSegments}.`
        : `Reading incomplete. Recited ${session.completedSegments} of ${session.totalSegments} sections.`;
      
      this.emit('SESSION_FAILED_VERIFICATION', { session, failureMessage });
      return {
        verified: false,
        status: session.status === 'STOPPED' ? 'STOPPED' : 'INCOMPLETE',
        message: failureMessage,
        session
      };
    }
  }

  /**
   * Synchronize full session state from client controller
   */
  syncClientState(clientSessionState) {
    if (!clientSessionState || !clientSessionState.sessionId) return null;
    const existing = this.getSessionById(clientSessionState.sessionId);
    if (existing) {
      Object.assign(existing, clientSessionState, { updatedAt: new Date().toISOString() });
      this.activeSession = existing;
      this.emit('SESSION_SYNCED', existing);
      return existing;
    } else {
      this.activeSession = clientSessionState;
      this.sessionHistory.unshift(clientSessionState);
      this.emit('SESSION_SYNCED', clientSessionState);
      return clientSessionState;
    }
  }

  getTelemetry() {
    const s = this.activeSession;
    if (!s) {
      return {
        hasActiveSession: false,
        telemetry: null
      };
    }

    const progressPct = s.totalSegments > 0 
      ? Math.round(((s.completedSegments + s.skippedSegments) / s.totalSegments) * 100) 
      : 0;

    return {
      hasActiveSession: true,
      sessionId: s.sessionId,
      documentId: s.documentId,
      documentTitle: s.documentTitle,
      totalWords: s.totalWords,
      totalCharacters: s.totalCharacters,
      totalSegments: s.totalSegments,
      currentSegment: s.currentSegment,
      completedSegments: s.completedSegments,
      skippedSegments: s.skippedSegments,
      retries: s.retryCount,
      playbackStatus: s.status,
      audioStarted: s.audioStarted ? 'YES' : 'NO',
      audioCompleted: s.audioCompleted ? 'YES' : 'NO',
      interrupted: s.interrupted ? 'YES' : 'NO',
      verified: s.verified ? 'YES' : 'NO',
      progressPercent: progressPct,
      segmentsSummary: s.segments.map(seg => ({
        index: seg.index,
        paragraph: seg.paragraphIndex,
        words: seg.wordCount,
        chars: seg.charCount,
        status: seg.status,
        retries: seg.retries || 0,
        textPreview: seg.text.substring(0, 60) + (seg.text.length > 60 ? '...' : '')
      }))
    };
  }
}

const readingSessionManager = new ReadingSessionManager();
module.exports = { ReadingSessionManager, readingSessionManager };
