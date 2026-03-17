import { parseDsl, type DslDictionary } from '@/lib/dsl-parser';
import type {
  DslParserWorkerRequest,
  DslParserWorkerResponse,
} from '@/lib/dsl-parser-worker-contract';

/** 비어 있는 DSL 사전 */
const EMPTY_DICTIONARY: DslDictionary = {
  termByName: new Map(),
  domainByName: new Map(),
  domainById: new Map(),
  wordMatchIndex: {
    exactCandidatesByNormalized: new Map(),
  },
};

/** 현재 워커가 보유한 DSL 사전 */
let currentDictionary: DslDictionary = EMPTY_DICTIONARY;

/**
 * 워커 응답을 메인 스레드로 보낸다.
 *
 * @param response 워커 응답 payload
 * @returns 없음
 */
function postWorkerResponse(response: DslParserWorkerResponse): void {
  self.postMessage(response);
}

self.onmessage = (event: MessageEvent<DslParserWorkerRequest>) => {
  const message = event.data;
  if (message.type === 'set-dictionary') {
    currentDictionary = message.dictionary;
    return;
  }

  try {
    const result = parseDsl(message.text, currentDictionary);
    postWorkerResponse({
      type: 'parsed',
      requestId: message.requestId,
      parseKey: message.parseKey,
      result,
    });
  } catch (error) {
    postWorkerResponse({
      type: 'error',
      requestId: message.requestId,
      parseKey: message.parseKey,
      message: error instanceof Error ? error.message : 'Unknown DSL parse worker error',
    });
  }
};
