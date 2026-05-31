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

// 测试 streamEvents
const t = performance.now();
let firstEvent = true;
const eventStream = graph.streamEvents(
  { messages: [new HumanMessage('say hi')] },
  { version: 'v2', streamMode: 'custom' }
);
console.log('streamEvents() returned:', (performance.now() - t).toFixed(1) + 'ms', typeof eventStream, eventStream?.constructor?.name);
console.log('is Promise:', eventStream instanceof Promise);
console.log('has asyncIterator:', typeof eventStream?.[Symbol.asyncIterator] === 'function');

for await (const event of eventStream) {
  if (firstEvent) {
    console.log('first event at:', (performance.now() - t).toFixed(1) + 'ms');
    console.log('event type:', event?.event, 'name:', event?.name);
    firstEvent = false;
  }
  if (event?.event === 'on_custom_event' || (event?.data?.chunk instanceof AIMessageChunk && event.data.chunk.content)) {
    process.stdout.write(event?.data?.chunk?.content || event?.data || '');
  }
}
console.log('\ntotal:', (performance.now() - t).toFixed(1) + 'ms');
