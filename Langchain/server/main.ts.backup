// import { ChatAnthropic } from '@langchain/anthropic'
import { HumanMessage, SystemMessage  } from '@langchain/core/messages'
import { ChatDeepSeek } from '@langchain/deepseek';
import 'dotenv/config'

// const anthropicModel = new ChatAnthropic({
//     model: 'claude-3-5-sonnet-20240620',
//     apiKey: 'sk-3AJ4Li695xVx26K5TcfzVtigIRD8bKSTNt2FuXw7wdw9PAwj',
//     anthropicApiUrl: 'https://api.antmoo.com',
//     temperature: 0
// })

const llm = new ChatDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY as string,
  model: "deepseek-v4-pro",
  temperature: 0,
});

const message = [
    new SystemMessage("将以下内容从中文翻译成英文"),
    new HumanMessage("好久不见!"),
]

// anthropicModel.invoke(message)

// const stream = await llm.stream(message)
// console.log(res)
// const chunks = []
// for await (const chunk of stream) {
//   chunks.push(chunk);
//   console.log(`${chunk.content}|`);
// }

// const stream = await llm.stream(message)

const result = await llm.invoke([
  { role: "user", content: "Hi! I'm Bob" },
  { role: "assistant", content: "Hello Bob! How can I assist you today?" },
  { role: "user", content: "What's my name?" },
]);