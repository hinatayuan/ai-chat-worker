// src/index.ts - Cloudflare Worker 主文件 (DeepSeek API 版本)
import { createSchema, createYoga } from 'graphql-yoga'

// 环境变量类型定义
interface Env {
  DEEPSEEK_API_KEY: string;
  CORS_ORIGIN?: string;
  ENVIRONMENT?: string;
}

// DeepSeek API 响应类型
interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  choices: {
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// GraphQL Schema 定义
const typeDefs = `
  type Query {
    hello: String!
    health: HealthStatus!
  }

  type Mutation {
    chat(input: ChatInput!): ChatResponse!
  }

  input ChatInput {
    message: String!
    conversation: [MessageInput!]
    model: String
    temperature: Float
    maxTokens: Int
  }

  input MessageInput {
    role: String!
    content: String!
  }

  type ChatResponse {
    success: Boolean!
    message: String
    error: String
    usage: Usage
    model: String
    timestamp: String
  }

  type Usage {
    promptTokens: Int!
    completionTokens: Int!
    totalTokens: Int!
  }

  type HealthStatus {
    status: String!
    timestamp: String!
    environment: String
    version: String!
  }
`

// GraphQL Resolvers
const resolvers = {
  Query: {
    hello: () => 'Hello from Cloudflare Workers + GraphQL + DeepSeek! 🚀',
    
    health: (_: any, __: any, { env }: { env: Env }) => ({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || 'unknown',
      version: '1.0.0'
    })
  },

  Mutation: {
    chat: async (_: any, { input }: { input: any }, { env }: { env: Env }) => {
      try {
        // 输入验证
        if (!input.message || input.message.trim().length === 0) {
          return {
            success: false,
            message: null,
            error: '消息内容不能为空',
            timestamp: new Date().toISOString()
          };
        }

        if (input.message.length > 4000) {
          return {
            success: false,
            message: null,
            error: '消息长度不能超过4000字符',
            timestamp: new Date().toISOString()
          };
        }

        // 构建消息历史
        const messages: DeepSeekMessage[] = [
          {
            role: 'system',
            content: '你是一个友好、有帮助的AI助手。请用简洁、准确的中文回答用户的问题。如果问题涉及敏感内容，请礼貌地拒绝并解释原因。'
          }
        ];

        // 添加对话历史（最多10条）
        if (input.conversation && input.conversation.length > 0) {
          const recentConversation = input.conversation.slice(-10);
          messages.push(...recentConversation);
        }

        // 添加当前消息
        messages.push({
          role: 'user',
          content: input.message.trim()
        });

        // 验证模型参数 - DeepSeek 支持的模型
        const allowedModels = [
          'deepseek-chat', 
          'deepseek-coder', 
          'deepseek-reasoner',
          'deepseek-v3'
        ];
        const model = allowedModels.includes(input.model) ? input.model : 'deepseek-chat';
        
        const temperature = Math.max(0, Math.min(2, input.temperature || 0.7));
        const maxTokens = Math.max(1, Math.min(4000, input.maxTokens || 1000));

        // 调用 DeepSeek API
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
            'User-Agent': 'AI-Chat-Worker/1.0.0'
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: temperature,
            max_tokens: maxTokens,
            stream: false,
            top_p: 0.9,
            frequency_penalty: 0,
            presence_penalty: 0
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('DeepSeek API Error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
          
          let errorMessage = 'DeepSeek API 调用失败';
          
          switch (response.status) {
            case 401:
              errorMessage = 'API 密钥无效或已过期';
              break;
            case 403:
              errorMessage = '没有权限访问该模型';
              break;
            case 429:
              errorMessage = '请求频率过高，请稍后再试';
              break;
            case 500:
              errorMessage = 'DeepSeek 服务器内部错误';
              break;
            default:
              errorMessage = `DeepSeek API 错误: ${response.status}`;
          }
          
          return {
            success: false,
            message: null,
            error: errorMessage,
            timestamp: new Date().toISOString()
          };
        }

        const data: DeepSeekResponse = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
          return {
            success: false,
            message: null,
            error: 'DeepSeek API 返回空响应',
            timestamp: new Date().toISOString()
          };
        }

        const aiMessage = data.choices[0].message.content;
        
        if (!aiMessage || aiMessage.trim().length === 0) {
          return {
            success: false,
            message: null,
            error: 'AI 返回空消息',
            timestamp: new Date().toISOString()
          };
        }

        return {
          success: true,
          message: aiMessage.trim(),
          error: null,
          model: model,
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0
          },
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        console.error('Chat error:', error);
        return {
          success: false,
          message: null,
          error: `处理请求时发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
          timestamp: new Date().toISOString()
        };
      }
    }
  }
}

// 创建 GraphQL Yoga 实例
const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
  // CORS 配置
  cors: {
    origin: (origin, { env }) => {
      // 允许的源
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://hinatayuan.github.io',
        'https://*.pages.dev',
        env.CORS_ORIGIN
      ].filter(Boolean);

      // 如果没有origin（例如Postman请求），允许访问
      if (!origin) return true;
      
      // 检查是否匹配允许的源
      return allowedOrigins.some(allowed => {
        if (allowed === '*') return true;
        if (allowed.includes('*')) {
          const pattern = allowed.replace(/\*/g, '.*');
          return new RegExp(`^${pattern}$`).test(origin);
        }
        return allowed === origin;
      });
    },
    credentials: true,
  },
  // GraphQL Playground 配置
  graphqlEndpoint: '/graphql',
  landingPage: false,
});

// Cloudflare Workers 导出
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 检查 DeepSeek API Key
    if (!env.DEEPSEEK_API_KEY) {
      return new Response(JSON.stringify({ 
        error: 'DeepSeek API Key 未配置',
        message: '请在 Cloudflare Dashboard 中设置 DEEPSEEK_API_KEY Secret'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 简单的健康检查端点
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'unknown',
        version: '1.0.0',
        api: 'DeepSeek'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 创建上下文
    const context = { env };

    try {
      // 使用 GraphQL Yoga 处理请求
      return await yoga.fetch(request, context);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : '未知错误'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  },
};