import type { AiChatResponse } from '@/types/ai-chat';
import AiSourceChips from './AiSourceChips';

interface AiAnswerCardProps {
  response: AiChatResponse;
}

export default function AiAnswerCard({ response }: AiAnswerCardProps) {
  if (response.status === 'ERROR') {
    return (
      <article role="alert">
        <h3>AI 응답을 만들지 못했습니다.</h3>
        <p>{response.error}</p>
      </article>
    );
  }

  return (
    <article>
      <p>{response.conclusion}</p>
      <AiSourceChips chips={response.sourceChips} />
      <section>
        <h4>확인된 사실</h4>
        <ul>
          {response.confirmedFacts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </section>
      <section>
        <h4>해석</h4>
        <p>{response.interpretation}</p>
      </section>
      <section>
        <h4>확인이 필요합니다</h4>
        <ul>
          {response.needsConfirmation.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
