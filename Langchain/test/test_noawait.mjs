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

async function callModel(state, cfg) {
  const writer = cfg?.writer;
  const chunks = [];
  for await (const chunk of await llm.stream(state.messages)) {
    chunks.push(chunk);
    if (writer && chunk.content) writer(chunk);
  }
  return { messages: [chunks.reduce((a, c) => a.concat(c))] };
}

const graph = new StateGraph(ann)
  .addNode('model', callModel)
  .addEdge('__start__', 'model')
  .addEdge('model', '__end__')
  .compile();

const t = performance.now();
let firstEvent = true;
// 直接 for await，不 await stream()
for await (const chunk of graph.stream(
  { messages: [new HumanMessage('say hi')] },
  { streamMode: 'custom' }
)) {
  if (firstEvent) {
    console.log('first event:', (performance.now() - t).toFixed(1) + 'ms', chunk?.content);
    firstEvent = false;
  }
}
console.log('total:', (performance.now() - t).toFixed(1) + 'ms');
