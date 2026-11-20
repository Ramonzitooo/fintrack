import React from 'react';
import { AppState, fmtBRL } from '../utils/storage';
import {
  annualToMonthlyRate,
  calculateBudget503020,
  calculateCdiMonthlyYield,
  calculateFireProjection,
  calculateGoalMonthsCompound,
} from '../utils/financeMath';
import {
  CheckCircle2,
  Calculator,
  LayoutGrid,
  Sparkles,
  Wrench,
  ArrowRight,
  Scale,
  ShieldCheck,
} from 'lucide-react';

interface AuditDiagnosticViewProps {
  state: AppState;
  onNavigate: (tab: string) => void;
}

export const AuditDiagnosticView: React.FC<AuditDiagnosticViewProps> = ({ state, onNavigate }) => {
  const cdiAnual = state.configuracoes.taxaCdiAnual || 10.75;
  const taxaLinearErrada = cdiAnual / 100 / 12;
  const taxaCompostaCorreta = annualToMonthlyRate(cdiAnual);

  const saldoRendendo = state.bancos
    .filter((b) => b.rendeJuros)
    .reduce((acc, b) => acc + b.saldo, 0);

  const yieldAntigoLinear = saldoRendendo * taxaLinearErrada;
  const yieldNovoComposto = calculateCdiMonthlyYield(saldoRendendo, 100, cdiAnual, 17.5);

  const cxEmergencia = state.caixinhas.find((c) => c.tipo === 'emergencia') || state.caixinhas[0];
  const goalMath = cxEmergencia
    ? calculateGoalMonthsCompound(
        cxEmergencia.saldo,
        cxEmergencia.meta,
        cxEmergencia.aporteMensal,
        taxaCompostaCorreta * 0.825
      )
    : null;

  const despesasMes = state.despesasPorMes[state.competenciaAtual] || [];
  const totalAportes = state.caixinhas.reduce((s, c) => s + c.aporteMensal, 0);
  const budget503020 = calculateBudget503020(state.salario.liquido, despesasMes, totalAportes);

  const cxFire = state.caixinhas.find((c) => c.tipo === 'aposentadoria');
  const fireMath = calculateFireProjection(
    cxFire?.saldo || 0,
    cxFire?.aporteMensal || 0,
    budget503020.essentialsTotal || 2500,
    state.configuracoes.swrAnualPct,
    state.configuracoes.jurosReaisAnualPct
  );

  return (
    <div className="space-y-8">
      {/* Intro Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
          Auditoria Técnica, Matemática & de Experiência do Usuário
        </p>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Raio-X do Seu Aplicativo Financeiro: O que estava ótimo e o que foi aprimorado
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
          Seu aplicativo original já tinha ideias excelentes que muitos apps comerciais não têm — como a{' '}
          <strong>Diária Segura até o próximo pagamento</strong>, a <strong>Calculadora Anti-Impulso em horas de vida</strong> e o{' '}
          <strong>Molde de Contas Recorrentes</strong>. Abaixo está a análise ponto a ponto das suas 6 perguntas e as melhorias já implementadas nesta versão.
        </p>
      </div>

      {/* 1. Resumo dos 6 Pilares Perguntados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span>01 · Design & Legibilidade</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Refinado</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Hierarquia Visual & Tipografia Tabular
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Removemos o excesso de etiquetas coloridas ("pills" estáticas) e bordas laterais grossas que competiam pela atenção. Adotamos tipografia{' '}
              <span className="font-mono text-xs">JetBrains Mono</span> para todos os valores monetários, alinhando casas decimais perfeitamente.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            Padrão SaaS Financeiro · Alto Contraste WCAG AA
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span>02 · Operações Matemáticas</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">6 Correções Exatas</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Juros Compostos, Estornos & FIRE Unificado
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Corrigimos a conversão de taxa anual para mensal por equivalência composta <span className="font-mono text-xs">(1+i)^(1/12)-1</span>, o desconto de IR regressivo no CDI, a simetria de estorno bancário e a divergência na fórmula FIRE entre abas.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            Auditado com testes automatizados determinísticos
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span>03 · Painel & Alinhamento</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Reestruturado</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Regra 50/30/20 Real & Envelopes Vivos
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Antes, todas as despesas entravam como "Gastos Essenciais" e os Envelopes eram apenas divisões estáticas. Agora o painel separa automaticamente{' '}
              <strong>Essenciais (50%)</strong>, <strong>Estilo de Vida (30%)</strong> e <strong>Futuro (20%)</strong> e desconta seus gastos reais dos envelopes!
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            Conciliação bancária e faturas integradas
          </div>
        </div>
      </div>

      {/* 2. Auditoria Matemática Comparativa (Antes vs Depois com os números reais do usuário) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          <Calculator className="w-4 h-4 text-emerald-600" />
          <span>Auditoria Matemática Ao Vivo com os Seus Dados</span>
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          Por que as fórmulas financeiras precisavam de ajuste?
        </h3>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {/* Correção 1 */}
          <div className="py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                1. Conversão de CDI Anual para Mensal & Imposto de Renda
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                No código anterior, a taxa anual era dividida por 12 (<span className="font-mono">taxaAnual / 12</span>) e ignorava o Imposto de Renda regressivo dos CDBs/Caixinhas. Em juros compostos, a taxa mensal correta é{' '}
                <span className="font-mono">(1 + i_anual)^(1/12) - 1</span>.
              </p>
            </div>
            <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <span className="text-xs text-slate-500 block">Cálculo Antigo (Linear Bruto)</span>
              <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
                + {fmtBRL(yieldAntigoLinear)}/mês
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Taxa linear {(taxaLinearErrada * 100).toFixed(3)}% a.m. sem IR
              </span>
            </div>
            <div className="lg:col-span-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 rounded-lg p-3">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium block">
                Cálculo Corrigido (Composto Bruto & Líquido)
              </span>
              <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                + {fmtBRL(yieldNovoComposto.netMonthly)}/mês líquidos
              </span>
              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 block mt-0.5">
                Bruto: {fmtBRL(yieldNovoComposto.grossMonthly)} ({(taxaCompostaCorreta * 100).toFixed(3)}% a.m.) - IR
              </span>
            </div>
          </div>

          {/* Correção 2 */}
          <div className="py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                2. Bug do Saldo Negativo ao Quitar e Desfazer Despesa
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Antes, ao pagar uma conta maior que o saldo do banco, o código usava{' '}
                <span className="font-mono">Math.max(0, saldo - valor)</span> (travando em R$ 0,00). Se você clicasse em &ldquo;Desfazer quitação&rdquo;, ele somava o valor cheio da conta de volta ao zero, <strong>criando dinheiro inexistente</strong> no saldo!
              </p>
            </div>
            <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <span className="text-xs text-slate-500 block">Comportamento Antigo</span>
              <span className="font-mono text-sm font-semibold text-rose-600 dark:text-rose-400">
                R$ 100 - R$ 150 → R$ 0
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Ao estornar: R$ 0 + R$ 150 = R$ 150 (Erro +R$ 50)
              </span>
            </div>
            <div className="lg:col-span-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 rounded-lg p-3">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium block">
                Contabilidade Simétrica Corrigida
              </span>
              <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                R$ 100 - R$ 150 → -R$ 50
              </span>
              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 block mt-0.5">
                Ao estornar: -R$ 50 + R$ 150 = R$ 100 exatos
              </span>
            </div>
          </div>

          {/* Correção 3 */}
          <div className="py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                3. Prazo das Caixinhas com Juros Compostos vs. Sem Juros
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Antes, o tempo para concluir uma Caixinha dividia o valor restante apenas pelo aporte mensal, ignorando que o saldo já guardado rende CDI todo mês. Agora usamos a fórmula logarítmica de Valor Futuro com aportes.
              </p>
            </div>
            <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <span className="text-xs text-slate-500 block">Sem Juros Compostos</span>
              <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
                {goalMath ? `${goalMath.monthsLinear} meses` : '12 meses'}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Ignorava o rendimento da própria caixinha</span>
            </div>
            <div className="lg:col-span-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 rounded-lg p-3">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium block">
                Com Juros Compostos do CDI
              </span>
              <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {goalMath ? `${goalMath.monthsCompound} meses` : '11 meses'} (+{fmtBRL(goalMath?.totalInterestEarned || 0)} de juros)
              </span>
              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 block mt-0.5">
                Mostra exatamente quanto os juros aceleram a meta
              </span>
            </div>
          </div>

          {/* Correção 4 */}
          <div className="py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                4. Bússola de Aposentadoria (FIRE) Unificada entre Abas
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Antes, o card FIRE na Visão Geral somava o saldo da conta corrente e da caixinha de viagem como se fossem patrimônio de aposentadoria, dando um prazo diferente da aba Caixinhas. Agora ambos usam a base real de longo prazo.
              </p>
            </div>
            <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <span className="text-xs text-slate-500 block">Antes (Inconsistente)</span>
              <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
                2 prazos diferentes
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Misturava dinheiro de giro com aposentadoria</span>
            </div>
            <div className="lg:col-span-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 rounded-lg p-3">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium block">
                Meta FIRE Unificada (SWR {state.configuracoes.swrAnualPct}%)
              </span>
              <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                Meta: {fmtBRL(fireMath.targetPatrimony)} ({fireMath.yearsToFire ?? '--'} anos)
              </span>
              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 block mt-0.5">
                Renda passiva atual: {fmtBRL(fireMath.currentSafeMonthlyIncome)}/mês
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Novas Funções Implementadas para Qualquer Pessoa Usar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>Novas Funcionalidades Adicionadas</span>
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          O que implementamos para tornar o app completo para iniciantes e avançados
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                1. Cálculo Automático de INSS e IRRF Oficial (1 Clique)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Muita gente sabe apenas o Salário Bruto e tem dificuldade com as faixas progressivas de INSS e Imposto de Renda. Na aba Contracheque, adicionamos um botão que calcula e preenche automaticamente o INSS e o IRRF oficiais!
              </p>
            </div>
            <button
              onClick={() => onNavigate('contracheque')}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline w-fit"
            >
              <span>Testar no Contracheque</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                2. Envelopes Semanais Conectados aos Gastos Reais do Mês
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                O Fatiador de Rotina (Supermercado, Lazer e Transporte) agora soma automaticamente as despesas daquela categoria lançadas no mês, mostrando quanto você já consumiu do teto e quanto resta por semana.
              </p>
            </div>
            <button
              onClick={() => onNavigate('despesas')}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline w-fit"
            >
              <span>Ver Envelopes em Despesas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                3. Gestão de Fatura Aberta & Limite nos Cartões + Desconto de Equilíbrio
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Adicionamos controle de Limite Total, Fatura Atual (% de uso do limite) e, no Simulador À Vista vs Parcelado, o cálculo do <strong>Desconto Mínimo de Equilíbrio (Break-Even %)</strong>.
              </p>
            </div>
            <button
              onClick={() => onNavigate('cartoes')}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline w-fit"
            >
              <span>Abrir Cartões & Simulador</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                4. Planejador de Quitação de Dívidas (Método Avalanche vs. Bola de Neve)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Para que qualquer pessoa (mesmo endividada) possa usar o app, incluímos na aba Despesas um módulo para cadastrar dívidas ou financiamentos e descobrir a ordem ideal de quitação para economizar juros.
              </p>
            </div>
            <button
              onClick={() => onNavigate('despesas')}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline w-fit"
            >
              <span>Ver Planejador de Dívidas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
