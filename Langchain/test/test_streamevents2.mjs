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
let firstToken = true;
const eventTypes = new Set();

for await (const event of graph.streamEvents(
  { messages: [new HumanMessage('say hi briefly')] },
  { version: 'v2' }
)) {
  eventTypes.add(event.event + ':' + event.name);
  if (event.event === 'on_custom_event') {
    const chunk = event.data;
    if (firstToken) {
      console.log('first on_custom_event at:', (performance.now() - t).toFixed(1) + 'ms');
      firstToken = false;
    }
    if (chunk instanceof AIMessageChunk && chunk.content) {
      process.stdout.write(typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content));
    }
  }
}
console.log('\ntotal:', (performance.now() - t).toFixed(1) + 'ms');
console.log('event types seen:', [...eventTypes].join(', '));
