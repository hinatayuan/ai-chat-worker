// src/utils/openai.ts - OpenAI API 工具函数
import { OpenAIMessage, OpenAIResponse, APIError, OpenAIModel } from '../types';

/**
 * 调用 OpenAI Chat Completions API
 */
export async function callOpenAI({
  apiKey,
  messages,
  model,
  temperature,
  maxTokens,
}: {
  apiKey: string;
  messages: OpenAIMessage[];
  model: OpenAIModel;
  temperature: number;
  maxTokens: number;
}): Promise<OpenAIResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'AI-Chat-Worker/1.0.0',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 0,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('OpenAI API Error:', {
      status: response.status,
      statusText: response.statusText,
      error: data,
    });

    // 处理不同的错误状态码
    const errorMessage = getOpenAIErrorMessage(response.status, data);
    throw new APIError(errorMessage, response.status, data.error?.code);
  }

  return data;
}

/**
 * 根据状态码和错误信息生成用户友好的错误消息
 */
function getOpenAIErrorMessage(status: number, errorData: any): string {
  const errorMessage = errorData.error?.message || '未知错误';

  switch (status) {
    case 400:
      if (errorMessage.includes('maximum context length')) {
        return '对话内容过长，请缩短消息或清空历史记录';
      }
      return `请求参数错误: ${errorMessage}`;

    case 401:
      return 'API 密钥无效或已过期';

    case 403:
      return '没有权限访问该模型，请检查您的 OpenAI 账户权限';

    case 429:
      if (errorMessage.includes('Rate limit')) {
        return '请求过于频繁，请稍后再试';
      }
      if (errorMessage.includes('quota')) {
        return 'API 配额已用完，请检查您的 OpenAI 账户余额';
      }
      return '请求频率过高，请稍后再试';

    case 500:
    case 502:
    case 503:
    case 504:
      return 'OpenAI 服务器暂时不可用，请稍后再试';

    default:
      return `OpenAI API 错误 (${status}): ${errorMessage}`;
  }
}

/**
 * 构建系统消息
 */
export function buildSystemMessage(): OpenAIMessage {
  return {
    role: 'system',
    content: `你是一个友好、有帮助的AI助手。请遵循以下指导原则：

1. 用简洁、准确的中文回答用户的问题
2. 如果问题涉及敏感内容，请礼貌地拒绝并解释原因
3. 不要提供有害、违法或不当的建议
4. 承认自己的局限性，如果不确定答案，请诚实说明
5. 保持对话的连贯性和上下文理解
6. 尽量提供有价值、有建设性的回复

请始终保持专业、友好的态度。`,
  };
}

/**
 * 估算消息的 token 数量（粗略估算）
 */
export function estimateTokens(text: string): number {
  // 简单的 token 估算：
  // 英文：大约 4 个字符 = 1 token
  // 中文：大约 1.5 个字符 = 1 token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * 检查消息是否会超出模型的 token 限制
 */
export function checkTokenLimit(messages: OpenAIMessage[], model: OpenAIModel): boolean {
  const totalText = messages.map(m => m.content).join('');
  const estimatedTokens = estimateTokens(totalText);
  
  // 不同模型的 token 限制
  const tokenLimits: Record<OpenAIModel, number> = {
    'gpt-3.5-turbo': 4096,
    'gpt-3.5-turbo-16k': 16384,
    'gpt-4': 8192,
    'gpt-4-32k': 32768,
    'gpt-4-turbo-preview': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
  };
  
  const limit = tokenLimits[model] || 4096;
  
  // 保留一些 token 用于响应
  return estimatedTokens < (limit * 0.8);
}

/**
 * 清理和优化消息历史
 */
export function optimizeMessages(messages: OpenAIMessage[], model: OpenAIModel): OpenAIMessage[] {
  let optimizedMessages = [...messages];
  
  // 如果超出 token 限制，从最早的用户消息开始删除
  while (!checkTokenLimit(optimizedMessages, model) && optimizedMessages.length > 1) {
    // 保留系统消息和最后一条用户消息
    const systemMessage = optimizedMessages.find(m => m.role === 'system');
    const lastUserMessage = optimizedMessages[optimizedMessages.length - 1];
    
    // 删除最早的非系统消息
    for (let i = 1; i < optimizedMessages.length - 1; i++) {
      if (optimizedMessages[i].role !== 'system') {
        optimizedMessages.splice(i, 1);
        break;
      }
    }
    
    // 如果只剩下系统消息和最后一条消息，就停止
    if (optimizedMessages.length <= 2) {
      break;
    }
  }
  
  return optimizedMessages;
}