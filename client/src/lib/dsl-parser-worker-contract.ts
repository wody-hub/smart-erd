import type { DslDictionary, DslParseResult } from '@/lib/dsl-parser';

/** DSL parser worker 요청 타입 */
export type DslParserWorkerRequest =
  | {
      /** 사전 동기화 */
      type: 'set-dictionary';
      /** 최신 DSL 사전 데이터 */
      dictionary: DslDictionary;
    }
  | {
      /** 텍스트 파싱 요청 */
      type: 'parse';
      /** 요청 시퀀스 ID */
      requestId: number;
      /** 중복 제거용 파싱 키 */
      parseKey: string;
      /** 파싱할 DSL 텍스트 */
      text: string;
    };

/** DSL parser worker 응답 타입 */
export type DslParserWorkerResponse =
  | {
      /** 파싱 성공 */
      type: 'parsed';
      /** 요청 시퀀스 ID */
      requestId: number;
      /** 중복 제거용 파싱 키 */
      parseKey: string;
      /** DSL 파싱 결과 */
      result: DslParseResult;
    }
  | {
      /** 파싱 실패 */
      type: 'error';
      /** 요청 시퀀스 ID */
      requestId: number;
      /** 중복 제거용 파싱 키 */
      parseKey: string;
      /** 오류 메시지 */
      message: string;
    };
