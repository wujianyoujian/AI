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

async function callModel(state, config) {
  const writer = config?.writer;
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

// 测试1：await stream()
console.log('--- test: await stream() ---');
let t = performance.now();
const streamResult = graph.stream(
  { messages: [new HumanMessage('say hi')] },
  { streamMode: 'custom' }
);
console.log('stream() call returned (no await):', (performance.now() - t).toFixed(1) + 'ms');
console.log('type:', typeof streamResult, streamResult?.constructor?.name);
console.log('is Promise:', streamResult instanceof Promise);
console.log('has Symbol.asyncIterator:', typeof streamResult[Symbol.asyncIterator] === 'function');

t = performance.now();
const resolved = await streamResult;
console.log('await resolved in:', (performance.now() - t).toFixed(1) + 'ms');
console.log('resolved type:', typeof resolved, resolved?.constructor?.name);
console.log('resolved has asyncIterator:', typeof resolved?.[Symbol.asyncIterator] === 'function');
