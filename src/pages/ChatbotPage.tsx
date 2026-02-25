// @ts-nocheck
import { useParams } from 'react-router-dom';
import ChatbotWidget from './ChatbotWidget';

export default function ChatbotPage() {
  const { token } = useParams<{ token: string }>();
  return (
    <div className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <ChatbotWidget token={token || ''} />
    </div>
  );
}
