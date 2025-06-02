'use strict';

const OpenAI = require('openai');
const config = require('../configs/server.config');
const { BadRequestError } = require('../utils/errorResponse');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openAi.API_KEY,
    });
  }

  async chatCompletion({ messages, model = 'gpt-3.5-turbo', maxTokens = 100 }) {
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error('ChatGPT API error:', error.message);
      throw new BadRequestError('Failed to get response from AI');
    }
  }

  async getProductRecommendations({ products, context, maxResults }) {
    try {
      const prompt = `
        Given the following product data and context, recommend up to ${maxResults} product IDs that are most relevant.
        Context: ${context}
        Products: ${JSON.stringify(products, null, 2)}
        Return only an array of product IDs (e.g., ["id1", "id2", ...]).
      `;

      const messages = [{ role: 'user', content: prompt }];
      const response = await this.chatCompletion({ messages, maxTokens: 100 });

      const recommendedIds = JSON.parse(response);
      if (!Array.isArray(recommendedIds)) {
        throw new BadRequestError('Invalid response format from AI');
      }

      return recommendedIds.slice(0, maxResults);
    } catch (error) {
      console.error('AI recommendation error:', error.message);

      return products
        .sort((a, b) => b.views - a.views)
        .slice(0, maxResults)
        .map((p) => p.id);
    }
  }
}

module.exports = new AIService();
