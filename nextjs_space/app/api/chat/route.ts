import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

const PHARMACY_SYSTEM_PROMPT = `You are DawaCare's AI Pharmacist Assistant - a helpful, knowledgeable pharmacy assistant.

Your expertise includes:
- Drug information and dosages
- Drug interaction warnings
- Side effects information  
- Stock availability (when inventory data provided)
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, checkStock } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // If user asks about stock, fetch medicine inventory
    let inventoryContext = '';
    if (checkStock) {
      const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
      
      // Extract potential medicine names from the query
      const medicines = await prisma.medicine.findMany({
        where: {
          OR: [
            { name: { contains: lastMessage.split(' ').filter((w: string) => w.length > 3).join(' '), mode: 'insensitive' } },
            { genericName: { contains: lastMessage.split(' ').filter((w: string) => w.length > 3).join(' '), mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: {
          name: true,
          genericName: true,
          quantity: true,
          unitPrice: true,
          expiryDate: true,
          category: true,
        },
      });

      if (medicines.length > 0) {
        inventoryContext = `\n\n[INVENTORY DATA - Use this to answer stock questions]:\n${medicines.map((m: { name: string; genericName: string | null; quantity: number; unitPrice: number; category: string; expiryDate: Date }) => 
          `- ${m.name} (${m.genericName || 'N/A'}): ${m.quantity} units in stock, KES ${m.unitPrice}, Category: ${m.category || 'General'}, Expires: ${m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : 'N/A'}`
        ).join('\n')}`;
      }
    }

    // Build messages with system prompt
    const apiMessages = [
      { role: 'system', content: PHARMACY_SYSTEM_PROMPT + inventoryContext },
      ...messages,
    ];

    // Call LLM API with streaming
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: apiMessages,
        stream: true,
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('LLM API Error:', error);
      return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
    }

    // Stream the response back
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        
        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            const chunk = decoder.decode(value);
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
