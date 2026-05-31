import { StateGraph, Annotation, messagesStateReducer } from '@langchain/langgraph';
import { HumanMessage, AIMessageChunk } from '@langchain/core/messages';
import { ChatDeepSeek } from '@langchain/deepseek';
import { config } from 'dotenv';
config();

const ann = Annotation.Root({
  messages: Annotation({ reducer: messagesStateReducer, default: () => [] })
});

const llm = new ChatDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-v4-flash',
  temperature: 0,
  streaming: true,
});

async function callModel(state) {
  const response = await llm.invoke(state.messages);
  return { messages: [response] };
}

const graph = new StateGraph(ann)
  .addNode('model', callModel)
  .addEdge('__start__', 'model')
  .addEdge('model', '__end__')
  .compile();

const t = performance.now();
let firstToken = true;

for await (const event of graph.streamEvents(
  { messages: [new HumanMessage('say hi briefly')] },
  { version: 'v2' }
)) {
  if (event.event === 'on_chat_model_stream' && event.name === 'ChatDeepSeek') {
    const chunk = event.data?.chunk;
    if (firstToken) {
      console.log('first token at:', (performance.now() - t).toFixed(1) + 'ms');
      firstToken = false;
    }
    if (chunk instanceof AIMessageChunk && chunk.content) {
      process.stdout.write(typeof chunk.content === 'string' ? chunk.content : '');
    }
  }
}
console.log('\ntotal:', (performance.now() - t).toFixed(1) + 'ms');
