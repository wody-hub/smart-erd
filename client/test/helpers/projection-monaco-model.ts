import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { editor } from 'monaco-editor';

/**
 * DOM 없이 실제 Monaco TextModel을 만든다. 토큰화 서비스만 비활성화하며 범위 검증·편집은 원본이다.
 * @param text 초기 LF 텍스트
 * @returns 호출자가 dispose할 Monaco 모델
 */
export async function createProjectionMonacoModel(text = ''): Promise<editor.ITextModel> {
  const { TextModel } = await import(
    pathToFileURL(resolve('node_modules/monaco-editor/esm/vs/editor/common/model/textModel.js'))
      .href
  );
  return new TextModel(
    text,
    'plaintext',
    {
      ...TextModel.DEFAULT_CREATION_OPTIONS,
      bracketPairColorizationOptions: { enabled: false, independentColorPoolPerBracketType: false },
    },
    null,
    { removeElements() {} },
    { requestRichLanguageFeatures() {} },
    { onDidChange: () => ({ dispose() {} }) },
    {
      createInstance: () => ({
        dispose() {},
        handleDidChangeContent() {},
        getLanguageId: () => 'plaintext',
      }),
    },
  );
}
