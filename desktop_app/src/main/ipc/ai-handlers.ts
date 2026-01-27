import { ipcMain } from 'electron';

// AI API configuration - using Abacus AI LLM API
const ABACUS_API_KEY = 'ad9f04cde75148c29f6fd90d25ab8452';
const ABACUS_API_URL = 'https://apps.abacus.ai/v1/chat/completions';

const PHARMACY_SYSTEM_PROMPT = `You are DawaCare's AI Pharmacist Assistant - a helpful, knowledgeable pharmacy assistant.

Your expertise includes:
- Drug information and dosages
- Drug interaction warnings
- Side effects information  
- General health advice

Response Guidelines:
- Keep responses clear and concise (2-4 short paragraphs max)
- Use simple bullet points with dashes (-) for lists
- Use **bold** for important terms or medicine names
- Use ## for section headings only when needed
- Be warm and empathetic but professional
- Never diagnose - only provide general information
- Always recommend consulting a pharmacist or doctor for serious concerns
- For dosages, say "as directed by your doctor/pharmacist"

End every response about medications with:
⚠️ DISCLAIMER: Always consult a licensed pharmacist or doctor for personalized medical advice.`;

export function registerAIHandlers() {
  // Handle AI chat requests
  ipcMain.handle('ai:chat', async (_event, messages: Array<{ role: string; content: string }>) => {
    try {
      console.log('[AI] Processing chat request with', messages.length, 'messages');

      const apiMessages = [
        { role: 'system', content: PHARMACY_SYSTEM_PROMPT },
        ...messages,
      ];

      const response = await fetch(ABACUS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ABACUS_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: apiMessages,
          max_tokens: 1500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI] API Error:', response.status, errorText);
        return {
          success: false,
          error: `API Error: ${response.status}`,
        };
      }

      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      const assistantMessage = data.choices?.[0]?.message?.content || 'I could not generate a response.';

      console.log('[AI] Response received successfully');
      return {
        success: true,
        message: assistantMessage,
      };
    } catch (error) {
      console.error('[AI] Chat error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  });
}
