import Anthropic from '@anthropic-ai/sdk';
import NewsAPI from 'newsapi';
import { requireAuth } from '../../lib/auth';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const newsapi = new NewsAPI(process.env.NEWSAPI_KEY);

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, context } = req.body;

  try {
    // Build system prompt
    let systemPrompt = `Você é um chatbot dedicado para o app "Rota ao Milhão", um tracker financeiro pessoal focado em alcançar 1 milhão de CHF.

Seu papel é:
- Ser super dedicado aos objetivos do usuário
- Falar sobre os ativos que o usuário tem (portfólios, ações, criptos, etc.), incluindo quantidades, preços de compra, datas, etc.
- Encontrar e compartilhar notícias relevantes sobre os ativos
- Lembrar o usuário dos objetivos e marcos, com progresso atual
- Incentivar progresso consistente
- Responder em português
- Ser imerso nos dados: conhecer portfólios, ativos detalhados, objetivos, ideias, histórico de patrimônio, etc.

Contexto detalhado do usuário:
- Patrimônio total: ${context.totalNW} CHF
- Objetivo: 1.000.000 CHF (${context.progress}%)
- Moeda base: ${context.baseCurrency}
- Data de início: ${context.startDate || 'Não definida'}
- Histórico de patrimônio: ${context.nwHistory.map(h => `${h.date}: ${h.value} CHF`).join(', ')}

Portfólios e Ativos:
${context.portfolios.map(p => `- ${p.name} (${p.type}):\n${p.assets.map(a => `  - ${a.name} (${a.ticker || 'fiat'}): ${a.quantity} ${a.currency}, preço compra: ${a.buyPrice || 'N/A'} em ${a.buyDate || 'N/A'}, notas: ${a.notes || 'N/A'}`).join('\n')}`).join('\n')}

Objetivos:
${context.goals.map(g => `- ${g.title} (${g.category}): ${g.current}/${g.target} ${g.unit}, prazo: ${g.deadline || 'N/A'}, notas: ${g.notes || 'N/A'}`).join('\n')}

Ideias:
${context.ideas.map(i => `- ${i.title} (${i.category}, status: ${i.status}): potencial ${i.potential}/5, viabilidade ${i.feasibility}/5, desc: ${i.description || 'N/A'}, notas: ${i.notes || 'N/A'}`).join('\n')}

Preços atuais (amostra): ${Object.entries(context.prices || {}).map(([k, v]) => `${k}: ${v.price} ${v.currency}`).join(', ')}

Se o usuário perguntar sobre notícias, busque informações relevantes sobre os ativos mencionados.`;

    // If message mentions news, fetch news
    let newsContext = '';
    if (message.toLowerCase().includes('notícia') || message.toLowerCase().includes('news')) {
      try {
        const tickers = context.portfolios.flatMap(p => p.assets).filter(a => a.ticker).map(a => a.ticker).slice(0, 5);
        const query = tickers.length > 0 ? tickers.join(' OR ') : 'finanças investimento';
        const news = await newsapi.v2.everything({
          q: query,
          language: 'pt',
          sortBy: 'relevancy',
          pageSize: 3,
        });
        if (news.articles && news.articles.length > 0) {
          newsContext = '\n\nNotícias recentes relevantes:\n' + news.articles.map(a => `- ${a.title} (${a.source.name})`).join('\n');
        }
      } catch (e) {
        console.log('News fetch failed:', e);
      }
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt + newsContext,
      tools: [
        {
          name: 'web_search',
          description: 'Search the web for current information',
          input_schema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The search query' }
            },
            required: ['query']
          }
        }
      ],
      messages: [
        { role: 'user', content: message },
      ],
    });

    if (response.stop_reason === 'tool_use') {
      const tool_use = response.content.find(c => c.type === 'tool_use');
      if (tool_use && tool_use.name === 'web_search') {
        const query = tool_use.input.query;
        // Perform web search using DuckDuckGo API
        const searchRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
        const searchData = await searchRes.json();
        const result = searchData.Abstract || searchData.Answer || searchData.Definition || 'Nenhum resultado encontrado.';

        // Follow-up message with search result
        const followUp = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: systemPrompt + newsContext,
          messages: [
            { role: 'user', content: message },
            { role: 'assistant', content: response.content },
            { role: 'user', content: [{ type: 'tool_result', tool_call_id: tool_use.id, content: result }] }
          ],
        });
        res.status(200).json({ reply: followUp.content[0].text });
      } else {
        res.status(200).json({ reply: response.content[0].text });
      }
    } else {
      res.status(200).json({ reply: response.content[0].text });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}