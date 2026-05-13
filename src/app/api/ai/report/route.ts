import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadDashboardData } from "@/lib/sheets";
import { buildTeamContext } from "@/lib/dataContext";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const REPORT_PROMPT = `Você é um analista de performance de canais do YouTube da Prota.
Gere um relatório semanal conciso para o time com base nos dados fornecidos.
Estruture assim:
1. **Resumo da semana** — principais números
2. **Destaques** — o que foi bem
3. **Pontos de atenção** — o que precisa de foco
4. **Recomendações** — 2 a 3 ações práticas

Seja direto, use dados específicos e responda em português brasileiro.`;

export async function GET() {
  const data = await loadDashboardData();

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: REPORT_PROMPT,
  });

  const teamReports = await Promise.all(
    data.teams.map(async (team) => {
      const context = buildTeamContext(data, team, 7);
      const result = await model.generateContent(context);
      return {
        team,
        content: result.response.text(),
      };
    })
  );

  return Response.json({
    reports: teamReports,
    generatedAt: new Date().toISOString(),
  });
}
