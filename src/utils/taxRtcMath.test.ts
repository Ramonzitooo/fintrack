import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  RTC_TRANSITION_SCHEDULE,
  RTC_REDUCTION_PRESETS,
  SIMPLES_ANEXOS,
  MAX_NFSE_XML_BYTES,
  getRtcScheduleForYear,
  calculateRegimeRegularRtc,
  calculateSimplesNacionalRtc,
  hasForbiddenXmlConstructs,
  stripXmlCommentsLinear,
  stripScriptBlocksLinear,
  hasValidElementPairLinear,
  extractXmlBlock,
  sanitizeNfseXmlForLocalService,
  parseNfseXml,
} from './taxRtcMath.ts';
import {
  DEFAULT_LOCAL_RTC_ENDPOINTS,
  MAX_DANFSE_PDF_BYTES,
  MIN_LOCAL_RTC_PORT,
  isAllowedLocalRtcUrl,
  isPdfMagicBytes,
  checkLocalRtcHealth,
  generateOfficialDanfsePdfLocal,
} from './taxRtcClient.ts';
import { normalizeState } from './storage.ts';

test('1. RTC_TRANSITION_SCHEDULE covers 2026..2033 official EC 132/2023 + LC 214/2025 rates', () => {
  assert.equal(RTC_TRANSITION_SCHEDULE.length, 8);

  const y2026 = getRtcScheduleForYear(2026);
  assert.equal(y2026.cbsPct, 0.9);
  assert.equal(y2026.ibsPct, 0.1);
  assert.equal(y2026.compensavelTeste, true);

  const y2027 = getRtcScheduleForYear(2027);
  assert.equal(y2027.cbsPct, 8.8);
  assert.equal(y2027.ibsPct, 0.1);

  const y2029 = getRtcScheduleForYear(2029);
  assert.equal(y2029.ibsPct, 1.77);

  const y2033 = getRtcScheduleForYear(2033);
  assert.equal(y2033.cbsPct, 8.8);
  assert.equal(y2033.ibsPct, 17.7);

  // Anos fora do intervalo fazem clamp seguro para 2026 e 2033
  assert.equal(getRtcScheduleForYear(2024).ano, 2026);
  assert.equal(getRtcScheduleForYear(2040).ano, 2033);
});

test('2. calculateRegimeRegularRtc computes 2026, 2027 and 2033 full rates accurately in exact cents', () => {
  const r2026 = calculateRegimeRegularRtc({
    valorOperacao: 10000,
    ano: 2026,
    reducaoPct: 0,
    creditosInsumos: 0,
  });
  assert.equal(r2026.aliquotaCbsEfetiva, 0.9);
  assert.equal(r2026.aliquotaIbsEfetiva, 0.1);
  assert.equal(r2026.valorCbsBruto, 90);
  assert.equal(r2026.valorIbsBruto, 10);
  assert.equal(r2026.totalTributosBruto, 100);
  assert.equal(r2026.totalTributosLiquido, 100);
  assert.equal(r2026.cargaEfetivaPct, 1);
  assert.equal(r2026.valorLiquidoOperacao, 9900);

  const r2027 = calculateRegimeRegularRtc({
    valorOperacao: 10000,
    ano: 2027,
    reducaoPct: 0,
    creditosInsumos: 0,
  });
  assert.equal(r2027.valorCbsBruto, 880);
  assert.equal(r2027.valorIbsBruto, 10);
  assert.equal(r2027.totalTributosLiquido, 890);
  assert.equal(r2027.cargaEfetivaPct, 8.9);

  const r2033 = calculateRegimeRegularRtc({
    valorOperacao: 10000,
    ano: 2033,
    reducaoPct: 0,
    creditosInsumos: 0,
  });
  assert.equal(r2033.valorCbsBruto, 880);
  assert.equal(r2033.valorIbsBruto, 1770);
  assert.equal(r2033.totalTributosBruto, 2650);
  assert.equal(r2033.totalTributosLiquido, 2650);
  assert.equal(r2033.cargaEfetivaPct, 26.5);
  assert.equal(r2033.valorLiquidoOperacao, 7350);
});

test('3. calculateRegimeRegularRtc applies 30%, 60% and 100% reduction presets', () => {
  const r30 = calculateRegimeRegularRtc({
    valorOperacao: 10000,
    ano: 2033,
    reducaoPct: RTC_REDUCTION_PRESETS.profissao_regulamentada.reducaoPct,
    creditosInsumos: 0,
  });
  assert.equal(r30.aliquotaCbsEfetiva, 6.16);
  assert.equal(r30.aliquotaIbsEfetiva, 12.39);
  assert.equal(r30.valorCbsBruto, 616);
  assert.equal(r30.valorIbsBruto, 1239);
  assert.equal(r30.totalTributosLiquido, 1855);
  assert.equal(r30.cargaEfetivaPct, 18.55);

  const r60 = calculateRegimeRegularRtc({
    valorOperacao: 10000,
    ano: 2033,
    reducaoPct: RTC_REDUCTION_PRESETS.saude_educacao.reducaoPct,
    creditosInsumos: 0,
  });
  assert.equal(r60.aliquotaCbsEfetiva, 3.52);
  assert.equal(r60.aliquotaIbsEfetiva, 7.08);
  assert.equal(r60.totalTributosLiquido, 1060);
  assert.equal(r60.cargaEfetivaPct, 10.6);

  const r100 = calculateRegimeRegularRtc({
    valorOperacao: 10000,
    ano: 2033,
    reducaoPct: RTC_REDUCTION_PRESETS.cesta_basica.reducaoPct,
    creditosInsumos: 500,
  });
  assert.equal(r100.aliquotaCbsEfetiva, 0);
  assert.equal(r100.aliquotaIbsEfetiva, 0);
  assert.equal(r100.creditoAproveitado, 0);
  assert.equal(r100.creditoExcedente, 500);
  assert.equal(r100.totalTributosLiquido, 0);
  assert.equal(r100.valorLiquidoOperacao, 10000);
});

test('4. calculateRegimeRegularRtc caps credits at CBS+IBS debit and keeps Imposto Seletivo (IS) non-creditable', () => {
  const res = calculateRegimeRegularRtc({
    valorOperacao: 10000,
    ano: 2033,
    reducaoPct: 0,
    creditosInsumos: 4000, // maior que débito CBS+IBS (2650)
    aliquotaIS: 10, // R$ 1.000 de Imposto Seletivo
  });
  assert.equal(res.valorIS, 1000);
  assert.equal(res.creditoAproveitado, 2650);
  assert.equal(res.creditoExcedente, 1350);
  assert.equal(res.totalTributosBruto, 3650);
  assert.equal(res.totalTributosLiquido, 1000); // Apenas o IS permanece devido
  assert.equal(res.valorLiquidoOperacao, 9000);
  assert.equal(res.cargaEfetivaPct, 10);

  // Custom rates & non-finite safety
  const custom = calculateRegimeRegularRtc({
    valorOperacao: NaN,
    ano: 2033,
    reducaoPct: -10,
    creditosInsumos: -50,
    cbsCustomPct: 9.0,
    ibsCustomPct: 18.0,
  });
  assert.equal(custom.valorOperacao, 0);
  assert.equal(custom.aliquotaCbsEfetiva, 9);
  assert.equal(custom.aliquotaIbsEfetiva, 18);
  assert.equal(custom.totalTributosLiquido, 0);
});

test('5. calculateSimplesNacionalRtc covers Annexes I to V, brackets 1..6, and rbt12 === 0', () => {
  assert.equal(Object.keys(SIMPLES_ANEXOS).length, 5);
  for (const anexo of ['I', 'II', 'III', 'IV', 'V'] as const) {
    assert.equal(SIMPLES_ANEXOS[anexo].faixas.length, 6);
  }

  // rbt12 === 0 cai na 1ª faixa sem divisão por zero
  const zeroRbt = calculateSimplesNacionalRtc({
    faturamentoMes: 10000,
    rbt12: 0,
    anexo: 'I',
  });
  assert.equal(zeroRbt.faixa, 1);
  assert.equal(zeroRbt.aliquotaNominalPct, 4.0);
  assert.equal(zeroRbt.aliquotaEfetivaPct, 4.0);
  assert.equal(zeroRbt.valorDasEstimado, 400);
  assert.equal(zeroRbt.receitaLiquidaEstimada, 9600);

  // Anexo II Faixa 3: RBT12 = 500.000 -> aliq 10%, PD 13.860 -> aliq efetiva = (50000 - 13860)/500000 = 7.228%
  const anexoII = calculateSimplesNacionalRtc({
    faturamentoMes: 40000,
    rbt12: 500000,
    anexo: 'II',
  });
  assert.equal(anexoII.faixa, 3);
  assert.equal(anexoII.aliquotaNominalPct, 10.0);
  assert.equal(anexoII.parcelaDeduzir, 13860);
  assert.equal(anexoII.aliquotaEfetivaPct, 7.228);
  assert.equal(anexoII.valorDasEstimado, 2891.2);

  // Anexo IV Faixa 2: RBT12 = 300.000 -> aliq 9%, PD 8.100 -> aliq efetiva = 6.3%
  const anexoIV = calculateSimplesNacionalRtc({
    faturamentoMes: 20000,
    rbt12: 300000,
    anexo: 'IV',
  });
  assert.equal(anexoIV.faixa, 2);
  assert.equal(anexoIV.aliquotaEfetivaPct, 6.3);
  assert.equal(anexoIV.valorDasEstimado, 1260);
});

test('6. calculateSimplesNacionalRtc applies Fator R (< 28% stays V, >= 28% migrates to III) and compares DAS vs por_fora', () => {
  // Fator R = 20% (< 28%) -> permanece no Anexo V
  const stayV = calculateSimplesNacionalRtc({
    faturamentoMes: 15000,
    rbt12: 180000,
    anexo: 'V',
    folha12m: 36000,
    ano: 2033,
    modoRecolhimentoRtc: 'das',
  });
  assert.equal(stayV.fatorRPct, 20);
  assert.equal(stayV.migradoPorFatorR, false);
  assert.equal(stayV.anexoEfetivo, 'V');
  assert.equal(stayV.aliquotaEfetivaPct, 15.5);
  assert.equal(stayV.valorDasEstimado, 2325);

  // Fator R = 28% (>= 28%) -> migra automaticamente para Anexo III
  const migrateIII = calculateSimplesNacionalRtc({
    faturamentoMes: 15000,
    rbt12: 180000,
    anexo: 'V',
    folha12m: 50400,
    ano: 2033,
    modoRecolhimentoRtc: 'das',
  });
  assert.equal(migrateIII.fatorRPct, 28);
  assert.equal(migrateIII.migradoPorFatorR, true);
  assert.equal(migrateIII.anexoEfetivo, 'III');
  assert.equal(migrateIII.aliquotaEfetivaPct, 6.0);
  assert.equal(migrateIII.valorDasEstimado, 900);

  // Modo "por_fora" em 2033 (CBS+IBS = 26.5%) transfere crédito cheio ao tomador PJ
  const porFora = calculateSimplesNacionalRtc({
    faturamentoMes: 15000,
    rbt12: 180000,
    anexo: 'III',
    ano: 2033,
    modoRecolhimentoRtc: 'por_fora',
  });
  assert.equal(porFora.modoRecolhimentoRtc, 'por_fora');
  assert.equal(porFora.valorCbsIbsPorFora, 3975);
  assert.equal(porFora.creditoTransferivelPj, 3975);
  assert.ok(porFora.creditoTransferivelPj > migrateIII.creditoTransferivelPj);
  assert.ok(porFora.totalTributosMes > porFora.valorDasEstimado);
  assert.ok(porFora.diferencaPorForaVsDas > 0);
});

test('7. parseNfseXml parses NFS-e Padrão Nacional (with namespaces & entities) and ABRASF XML safely', () => {
  const xmlNacional = `<?xml version="1.0" encoding="UTF-8"?>
    <ns1:NFSe xmlns:ns1="http://www.sped.fazenda.gov.br/nfse">
      <ns1:infNFSe>
        <ns1:nNFSe>202600000123</ns1:nNFSe>
        <ns1:dhProc>2026-05-10T14:30:00-03:00</ns1:dhProc>
        <ns1:emit>
          <ns1:CNPJ>12345678000199</ns1:CNPJ>
          <ns1:xNome>Tech &amp; Finanças Ltda</ns1:xNome>
        </ns1:emit>
        <ns1:DPS>
          <ns1:infDPS>
            <ns1:toma>
              <ns1:CNPJ>98765432000111</ns1:CNPJ>
              <ns1:xNome>Cliente &quot;Alpha&quot; S/A</ns1:xNome>
            </ns1:toma>
            <ns1:serv>
              <ns1:cServ><ns1:cTribNac>010701</ns1:cTribNac><ns1:xDescServ>Consultoria &lt;TI&gt; &amp; Arquitetura</ns1:xDescServ></ns1:cServ>
            </ns1:serv>
            <ns1:valores>
              <ns1:vServPrest><ns1:vServ>10000.00</ns1:vServ></ns1:vServPrest>
              <ns1:trib>
                <ns1:tribMun><ns1:pAliq>5.00</ns1:pAliq><ns1:vISSQN>500.00</ns1:vISSQN><ns1:tpRetISSQN>2</ns1:tpRetISSQN></ns1:tribMun>
                <ns1:vCBS>90.00</ns1:vCBS>
                <ns1:vIBS>10.00</ns1:vIBS>
              </ns1:trib>
            </ns1:valores>
          </ns1:infDPS>
        </ns1:DPS>
      </ns1:infNFSe>
    </ns1:NFSe>`;

  const parsedNac = parseNfseXml(xmlNacional);
  assert.equal(parsedNac.ok, true);
  if (parsedNac.ok) {
    assert.equal(parsedNac.data.formato, 'nacional');
    assert.equal(parsedNac.data.numero, '202600000123');
    assert.equal(parsedNac.data.prestadorNome, 'Tech & Finanças Ltda');
    assert.equal(parsedNac.data.prestadorCnpj, '12345678000199');
    assert.equal(parsedNac.data.tomadorNome, 'Cliente "Alpha" S/A');
    assert.equal(parsedNac.data.tomadorDocumento, '98765432000111');
    // Caracteres '<' e '>' decodificados de &lt;/&gt; são removidos pós-decodificação para evitar injeção de tags
    assert.equal(parsedNac.data.discriminacao, 'Consultoria TI & Arquitetura');
    assert.equal(parsedNac.data.codigoServico, '010701');
    assert.equal(parsedNac.data.valorServicos, 10000);
    assert.equal(parsedNac.data.valorIss, 500);
    assert.equal(parsedNac.data.aliquotaIss, 5);
    assert.equal(parsedNac.data.issRetido, true);
    assert.equal(parsedNac.data.valorCbs, 90);
    assert.equal(parsedNac.data.valorIbs, 10);
    assert.equal(parsedNac.data.valorLiquido, 9500);
  }

  const xmlAbrasf = `<?xml version="1.0" encoding="UTF-8"?>
    <CompNfse>
      <Nfse>
        <InfNfse>
          <Numero>4589</Numero>
          <DataEmissao>2026-06-15T10:00:00</DataEmissao>
          <PrestadorServico>
            <IdentificacaoPrestador><Cnpj>11222333000144</Cnpj></IdentificacaoPrestador>
            <RazaoSocial>Studio Design Brasil ME</RazaoSocial>
          </PrestadorServico>
          <TomadorServico>
            <IdentificacaoTomador><Cpf>12345678900</Cpf></IdentificacaoTomador>
            <RazaoSocial>Maria Silva</RazaoSocial>
          </TomadorServico>
          <Servico>
            <ItemListaServico>17.01</ItemListaServico>
            <Discriminacao>Desenvolvimento Web</Discriminacao>
            <Valores>
              <ValorServicos>3500.50</ValorServicos>
              <ValorIss>70.01</ValorIss>
              <Aliquota>2.00</Aliquota>
              <IssRetido>2</IssRetido>
              <ValorLiquidoNfse>3500.50</ValorLiquidoNfse>
            </Valores>
          </Servico>
        </InfNfse>
      </Nfse>
    </CompNfse>`;

  const parsedAbrasf = parseNfseXml(xmlAbrasf);
  assert.equal(parsedAbrasf.ok, true);
  if (parsedAbrasf.ok) {
    assert.equal(parsedAbrasf.data.formato, 'abrasf');
    assert.equal(parsedAbrasf.data.numero, '4589');
    assert.equal(parsedAbrasf.data.prestadorNome, 'Studio Design Brasil ME');
    assert.equal(parsedAbrasf.data.tomadorNome, 'Maria Silva');
    assert.equal(parsedAbrasf.data.tomadorDocumento, '12345678900');
    assert.equal(parsedAbrasf.data.valorServicos, 3500.5);
    assert.equal(parsedAbrasf.data.valorIss, 70.01);
    assert.equal(parsedAbrasf.data.issRetido, false);
    assert.equal(parsedAbrasf.data.valorLiquido, 3500.5);
  }
});

test('8. parseNfseXml rejects empty, malformed, XXE DOCTYPE, non-NFSe and > 2MB payloads', () => {
  assert.equal(parseNfseXml('').ok, false);
  assert.equal(parseNfseXml('not xml at all').ok, false);
  assert.equal(parseNfseXml('<NFSe><unclosed>').ok, false);
  assert.equal(parseNfseXml('<foo><bar>123</bar></foo>').ok, false);

  const xxePayload = `<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><NFSe><nNFSe>&xxe;</nNFSe></NFSe>`;
  assert.equal(parseNfseXml(xxePayload).ok, false);

  const oversized = `<NFSe><nNFSe>${'A'.repeat(MAX_NFSE_XML_BYTES + 10)}</nNFSe></NFSe>`;
  assert.equal(parseNfseXml(oversized).ok, false);
});

test('9. isAllowedLocalRtcUrl and local RTC client strictly block SSRF / external hosts / dangerous protocols', async () => {
  // Endpoints padrão devem ser válidos
  assert.equal(isAllowedLocalRtcUrl(DEFAULT_LOCAL_RTC_ENDPOINTS.regimeRegular), true);
  assert.equal(isAllowedLocalRtcUrl(DEFAULT_LOCAL_RTC_ENDPOINTS.simplesNacional), true);
  assert.equal(isAllowedLocalRtcUrl(DEFAULT_LOCAL_RTC_ENDPOINTS.geradorDanfse), true);
  assert.equal(isAllowedLocalRtcUrl('http://127.0.0.1:8080/api'), true);

  // Bloqueios obrigatórios (SSRF, HTTPS externo, protocolos perigosos, credenciais, subdomínios falsos)
  assert.equal(isAllowedLocalRtcUrl('https://localhost:8080'), false);
  assert.equal(isAllowedLocalRtcUrl('http://example.com:8080'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost.evil.com:8080'), false);
  assert.equal(isAllowedLocalRtcUrl('http://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isAllowedLocalRtcUrl('http://0.0.0.0:8080'), false);
  assert.equal(isAllowedLocalRtcUrl('http://user:pass@localhost:8080'), false);
  assert.equal(isAllowedLocalRtcUrl('file:///etc/passwd'), false);
  assert.equal(isAllowedLocalRtcUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedLocalRtcUrl(''), false);

  // Client recusa URL externa sem efetuar rede
  const blockedHealth = await checkLocalRtcHealth('https://evil.example.com');
  assert.equal(blockedHealth.online, false);
  assert.ok(blockedHealth.error && blockedHealth.error.includes('bloqueada'));

  const blockedPdf = await generateOfficialDanfsePdfLocal('https://evil.example.com', '<NFSe/>');
  assert.equal(blockedPdf.ok, false);
});

test('10. storage normalizeState preserves Impostos expense category', () => {
  const norm = normalizeState({
    despesasPorMes: {
      '2026-11': [
        {
          id: 'imp_1',
          descricao: 'DAS Simples Nacional',
          valor: 900,
          diaVencimento: 20,
          paga: false,
          categoria: 'Impostos',
        },
      ],
    },
  });
  assert.equal(norm.despesasPorMes['2026-11'][0].categoria, 'Impostos');
});

test('11. Anti-ReDoS O(N): parseNfseXml and linear XML helpers process adversarial unclosed payloads in < 150ms', () => {
  // Payload malicioso com 150.000 tags abertas sem fechamento (~450 KB)
  const unclosedTagsPayload = '<a>'.repeat(150_000);
  const t0 = performance.now();
  const parsedUnclosed = parseNfseXml(unclosedTagsPayload);
  const elapsedUnclosed = performance.now() - t0;
  assert.equal(parsedUnclosed.ok, false);
  assert.ok(
    elapsedUnclosed < 150,
    `Esperado tempo linear < 150ms para 150k tags abertas, obteve ${elapsedUnclosed.toFixed(1)}ms`
  );

  // Comentários, scripts e blocos de tag sem fechamento também devem executar em tempo linear
  const unclosedComments = '<NFSe>' + '<!--'.repeat(100_000) + '</NFSe>';
  const unclosedScripts = '<NFSe>' + '<script>'.repeat(100_000) + '</NFSe>';
  const unclosedEmits = '<NFSe>' + '<emit>'.repeat(100_000) + '</NFSe>';

  const t1 = performance.now();
  assert.equal(parseNfseXml(unclosedComments).ok, false);
  assert.equal(parseNfseXml(unclosedScripts).ok, false);
  assert.equal(parseNfseXml(unclosedEmits).ok, true);
  assert.equal(extractXmlBlock('<emit>'.repeat(150_000), 'emit'), null);
  assert.equal(hasValidElementPairLinear(unclosedTagsPayload), false);
  const elapsedExtra = performance.now() - t1;
  assert.ok(
    elapsedExtra < 250,
    `Esperado tempo linear agregado < 250ms, obteve ${elapsedExtra.toFixed(1)}ms`
  );

  // Checagem rápida pré-TextEncoder rejeita string acima de MAX_NFSE_XML_BYTES instantaneamente
  const oversized = 'A'.repeat(MAX_NFSE_XML_BYTES + 1);
  const t2 = performance.now();
  assert.equal(parseNfseXml(oversized).ok, false);
  assert.equal(sanitizeNfseXmlForLocalService(oversized).ok, false);
  assert.ok(performance.now() - t2 < 50);
});

test('12. Preservação de <![CDATA[...]]> em parseNfseXml (ABRASF e blocos mistos)', () => {
  const xmlAbrasfCdata = `<?xml version="1.0" encoding="UTF-8"?>
    <CompNfse>
      <Nfse>
        <InfNfse>
          <Numero>7712</Numero>
          <PrestadorServico>
            <RazaoSocial><![CDATA[Alpha & Ômega Consultoria]]></RazaoSocial>
            <Cnpj>11222333000144</Cnpj>
          </PrestadorServico>
          <Servico>
            <Discriminacao><![CDATA[Consultoria TI — Projeto Alpha & Beta]]></Discriminacao>
            <Valores>
              <ValorServicos>5000.00</ValorServicos>
              <ValorIss>250.00</ValorIss>
              <ValorLiquidoNfse>5000.00</ValorLiquidoNfse>
            </Valores>
          </Servico>
        </InfNfse>
      </Nfse>
    </CompNfse>`;

  const parsed = parseNfseXml(xmlAbrasfCdata);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.formato, 'abrasf');
    assert.equal(parsed.data.numero, '7712');
    assert.equal(parsed.data.prestadorNome, 'Alpha & Ômega Consultoria');
    assert.equal(parsed.data.discriminacao, 'Consultoria TI — Projeto Alpha & Beta');
    assert.equal(parsed.data.valorServicos, 5000);
  }

  // CDATA misturado com subtags e conteúdo malicioso embutido dentro de CDATA
  const xmlMixed = `<CompNfse><InfNfse><Numero>88</Numero><Discriminacao><obs>Serviço:</obs> <![CDATA[Auditoria <script>alert(1)</script> & Compliance\u202e]]></Discriminacao></InfNfse></CompNfse>`;
  const parsedMixed = parseNfseXml(xmlMixed);
  assert.equal(parsedMixed.ok, true);
  if (parsedMixed.ok) {
    assert.equal(parsedMixed.data.discriminacao, 'Serviço: Auditoria & Compliance');
    assert.ok(!parsedMixed.data.discriminacao.includes('<script'));
    assert.ok(!parsedMixed.data.discriminacao.includes('\u202e'));
  }
});

test('13. Anti-bypass via entidades XML, surrogates UTF-16, controles C0/C1 e Unicode Bidi overrides', () => {
  const xmlAdversarial = `<?xml version="1.0" encoding="UTF-8"?>
    <NFSe>
      <infNFSe>
        <nNFSe>&#x202e;9999</nNFSe>
        <emit>
          <xNome>Empresa&#xD800;&#x00;&#x07;&#x85;&#x2066;&#x061c; &amp; Cia\u202e\u2069\u000b</xNome>
          <CNPJ>12345678000199</CNPJ>
        </emit>
        <DPS>
          <infDPS>
            <toma>
              <xNome>&#x3c;script&#x3e;alert(2)&#x3c;/script&#x3e;Cliente &#231;&#xE3;o</xNome>
            </toma>
            <serv>
              <cServ>
                <xDescServ>&lt;script&gt;alert(1)&lt;/script&gt;Consultoria &lt;img src=x onerror=alert(1)&gt;</xDescServ>
              </cServ>
            </serv>
            <valores>
              <vServPrest><vServ>1500.00</vServ></vServPrest>
            </valores>
          </infDPS>
        </DPS>
      </infNFSe>
    </NFSe>`;

  const parsed = parseNfseXml(xmlAdversarial);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.numero, '9999');
    assert.ok(!parsed.data.numero.includes('\u202e'));

    assert.equal(parsed.data.prestadorNome, 'Empresa & Cia');
    assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u061C\u202A-\u202E\u2066-\u2069\uD800-\uDFFF]/.test(parsed.data.prestadorNome));

    assert.equal(parsed.data.tomadorNome, 'Cliente ção');
    assert.ok(!parsed.data.tomadorNome.includes('<script'));
    assert.ok(!parsed.data.tomadorNome.includes('alert(2)'));

    assert.ok(!parsed.data.discriminacao.includes('<script>'));
    assert.ok(!parsed.data.discriminacao.includes('</script>'));
    assert.ok(!parsed.data.discriminacao.includes('<'));
    assert.ok(!parsed.data.discriminacao.includes('>'));
    assert.ok(parsed.data.discriminacao.startsWith('Consultoria'));
  }
});

test('14. Bloqueio de xi:include, xml-stylesheet, ATTLIST, NOTATION e higienização via sanitizeNfseXmlForLocalService', () => {
  const forbiddenPayloads = [
    {
      label: 'xi:include',
      xml: '<NFSe xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="file:///etc/passwd" parse="text"/><nNFSe>1</nNFSe></NFSe>',
    },
    {
      label: 'include sem prefixo',
      xml: '<NFSe><include href="http://127.0.0.1:8080/secret"/><nNFSe>1</nNFSe></NFSe>',
    },
    {
      label: 'xml-stylesheet (XSLT)',
      xml: '<?xml version="1.0"?><?xml-stylesheet type="text/xsl" href="http://evil.local/x.xsl"?><NFSe><nNFSe>1</nNFSe></NFSe>',
    },
    {
      label: 'ATTLIST',
      xml: '<!ATTLIST NFSe id ID #IMPLIED><NFSe><nNFSe>1</nNFSe></NFSe>',
    },
    {
      label: 'NOTATION',
      xml: '<!NOTATION gif SYSTEM "image/gif"><NFSe><nNFSe>1</nNFSe></NFSe>',
    },
    {
      label: 'DOCTYPE',
      xml: '<!DOCTYPE nfse SYSTEM "http://evil.local/dtd"><NFSe><nNFSe>1</nNFSe></NFSe>',
    },
    {
      label: 'ENTITY',
      xml: '<!ENTITY xxe SYSTEM "file:///etc/passwd"><NFSe><nNFSe>&xxe;</nNFSe></NFSe>',
    },
  ];

  for (const item of forbiddenPayloads) {
    assert.equal(hasForbiddenXmlConstructs(item.xml), true, `hasForbiddenXmlConstructs deve detectar ${item.label}`);
    assert.equal(parseNfseXml(item.xml).ok, false, `parseNfseXml deve rejeitar ${item.label}`);
    assert.equal(
      sanitizeNfseXmlForLocalService(item.xml).ok,
      false,
      `sanitizeNfseXmlForLocalService deve rejeitar ${item.label}`
    );
  }

  // Smuggling de DOCTYPE / xi:include fragmentado por comentário XML também é bloqueado
  const splitSmuggle = '<!DOC<!--x-->TYPE foo><NFSe><nNFSe>1</nNFSe></NFSe>';
  assert.equal(sanitizeNfseXmlForLocalService(splitSmuggle).ok, false);
  assert.equal(parseNfseXml(splitSmuggle).ok, false);

  // XML legítimo com comentários, <script> embutido e Unicode 'İ' (U+0130) é limpo sem corrupção de índices
  const dirtyValid = `<?xml version="1.0" encoding="UTF-8"?>
    <!-- comentário interno -->
    <NFSe>
      <nNFSe>202699</nNFSe>
      <xDescServ>İstanbul serviços</xDescServ>
      <SCRIPT type="text/javascript">alert(1)</SCRIPT>
      <vServ>100.00</vServ>
    </NFSe>`;
  assert.equal(hasForbiddenXmlConstructs(dirtyValid), false);

  const sanitized = sanitizeNfseXmlForLocalService(dirtyValid);
  assert.equal(sanitized.ok, true);
  if (sanitized.ok) {
    assert.ok(!sanitized.xml.includes('<!--'));
    assert.ok(!sanitized.xml.toLowerCase().includes('<script'));
    assert.ok(sanitized.xml.includes('<nNFSe>202699</nNFSe>'));
    assert.ok(sanitized.xml.includes('İstanbul serviços'));
  }

  // Helpers lineares individuais preservam tags semelhantes e removem comentários/scripts corretamente
  assert.equal(stripXmlCommentsLinear('a<!--x-->b<!--unclosed'), 'ab');
  assert.equal(
    stripScriptBlocksLinear('<scripture>ok</scripture><script>evil()</script><svg:script/>end'),
    '<scripture>ok</scripture>  end'
  );
});

test('15. MÉDIO-03: isAllowedLocalRtcUrl enforces explicit non-privileged port and blocks query, hash, path traversal and external hosts', () => {
  assert.equal(MAX_DANFSE_PDF_BYTES, 10 * 1024 * 1024);
  assert.equal(MIN_LOCAL_RTC_PORT, 1024);

  // Aceita endpoints locais válidos com porta explícita >= 1024
  assert.equal(isAllowedLocalRtcUrl('http://localhost:8080'), true);
  assert.equal(isAllowedLocalRtcUrl('http://127.0.0.1:8082/danfse'), true);
  assert.equal(isAllowedLocalRtcUrl('http://localhost:1024'), true);
  assert.equal(isAllowedLocalRtcUrl('http://127.0.0.1:65535/api/v1'), true);

  // Rejeita query strings e hashes (inclusive vazios)
  assert.equal(isAllowedLocalRtcUrl('http://localhost:8080?x=1'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost:8080/danfse?x=1'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost:8080/?'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost:8080#a'), false);
  assert.equal(isAllowedLocalRtcUrl('http://127.0.0.1:8082/danfse#a'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost:8080/#'), false);

  // Rejeita path traversal (bruto, normalizado, percent-encoded e protocol-relative //)
  assert.equal(isAllowedLocalRtcUrl('http://localhost:8080/../etc'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost:8080/api/../secret'), false);
  assert.equal(isAllowedLocalRtcUrl('http://127.0.0.1:8082/%2e%2e/etc'), false);
  assert.equal(isAllowedLocalRtcUrl('http://127.0.0.1:8082/%2E%2E/etc'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost:8080/..\\etc'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost:8082//evil.com'), false);

  // Rejeita portas privilegiadas (< 1024) e URLs sem porta explícita
  assert.equal(isAllowedLocalRtcUrl('http://localhost:80'), false);
  assert.equal(isAllowedLocalRtcUrl('http://127.0.0.1:80/danfse'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost:22'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost:443'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost:1023'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost'), false);
  assert.equal(isAllowedLocalRtcUrl('http://127.0.0.1'), false);
  assert.equal(isAllowedLocalRtcUrl('http://localhost/danfse'), false);

  // Rejeita hosts externos, protocolos diferentes de http e credenciais
  assert.equal(isAllowedLocalRtcUrl('http://example.com:8080'), false);
  assert.equal(isAllowedLocalRtcUrl('https://localhost:8080'), false);
  assert.equal(isAllowedLocalRtcUrl('http://user:pass@localhost:8080'), false);
  assert.equal(isAllowedLocalRtcUrl('http://169.254.169.254:8080/latest'), false);
});

test('16. MÉDIO-03: isPdfMagicBytes validates %PDF- signature and rejects HTML or short buffers', () => {
  const enc = new TextEncoder();

  // Assinatura mágica válida %PDF-
  assert.equal(isPdfMagicBytes(enc.encode('%PDF-1.7\n%binary')), true);
  assert.equal(isPdfMagicBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);

  // Rejeita HTML disfarçado, prefixos inválidos e buffers < 5 bytes
  assert.equal(isPdfMagicBytes(enc.encode('<html><body>not a pdf</body></html>')), false);
  assert.equal(isPdfMagicBytes(enc.encode('<!DOCTYPE html><html></html>')), false);
  assert.equal(isPdfMagicBytes(enc.encode(' %PDF-1.7')), false);
  assert.equal(isPdfMagicBytes(enc.encode('%PDF')), false);
  assert.equal(isPdfMagicBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46])), false);
  assert.equal(isPdfMagicBytes(new Uint8Array(0)), false);
});

test('17. MÉDIO-03: generateOfficialDanfsePdfLocal and checkLocalRtcHealth enforce pre-fetch XML sanitization, redirect:error, size limit and PDF magic bytes', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  let lastUrl = '';
  let lastInit: RequestInit | undefined;

  try {
    // 1. Rejeita XXE (<!DOCTYPE) e XInclude (<xi:include) ANTES de qualquer chamada de rede
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('fetch não deveria ter sido chamado para XML proibido');
    }) as typeof fetch;

    const doctypeRes = await generateOfficialDanfsePdfLocal(
      'http://localhost:8082',
      '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><NFSe><nNFSe>&xxe;</nNFSe></NFSe>'
    );
    assert.equal(doctypeRes.ok, false);
    assert.equal(fetchCalls, 0);

    const xincludeRes = await generateOfficialDanfsePdfLocal(
      'http://127.0.0.1:8082/danfse',
      '<NFSe xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="file:///etc/passwd"/><nNFSe>1</nNFSe></NFSe>'
    );
    assert.equal(xincludeRes.ok, false);
    assert.equal(fetchCalls, 0);

    // 2. checkLocalRtcHealth exige redirect: 'error'
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      fetchCalls++;
      lastUrl = String(input);
      lastInit = init;
      return new Response('OK', { status: 200 });
    }) as typeof fetch;

    const healthOk = await checkLocalRtcHealth('http://localhost:8080');
    assert.equal(healthOk.online, true);
    assert.equal(lastUrl, 'http://localhost:8080');
    assert.equal(lastInit?.redirect, 'error');

    // 3. generateOfficialDanfsePdfLocal monta /danfse via new URL, passa redirect:'error' e aceita PDF válido
    const validXml = '<?xml version="1.0"?><NFSe><!-- comentario --><nNFSe>42</nNFSe></NFSe>';
    const validPdfBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      fetchCalls++;
      lastUrl = String(input);
      lastInit = init;
      return new Response(validPdfBytes, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      });
    }) as typeof fetch;

    const pdfOk = await generateOfficialDanfsePdfLocal('http://localhost:8082', validXml);
    assert.equal(pdfOk.ok, true);
    assert.equal(lastUrl, 'http://localhost:8082/danfse');
    assert.equal(lastInit?.redirect, 'error');
    assert.equal(typeof lastInit?.body, 'string');
    assert.ok(!(lastInit?.body as string).includes('<!--'));
    if (pdfOk.ok) {
      assert.equal(pdfOk.blob.type, 'application/pdf');
      assert.equal(pdfOk.blob.size, validPdfBytes.byteLength);
    }

    // 4. Rejeita resposta text/html disfarçada de application/pdf (magic bytes inválidos)
    globalThis.fetch = (async () =>
      new Response('<html><body>Fake PDF</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      })) as typeof fetch;

    const fakePdf = await generateOfficialDanfsePdfLocal('http://localhost:8082', validXml);
    assert.equal(fakePdf.ok, false);

    // 5. Rejeita resposta com Content-Length > MAX_DANFSE_PDF_BYTES imediatamente
    globalThis.fetch = (async () =>
      new Response(validPdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': String(MAX_DANFSE_PDF_BYTES + 1),
        },
      })) as typeof fetch;

    const headerTooBig = await generateOfficialDanfsePdfLocal('http://localhost:8082', validXml);
    assert.equal(headerTooBig.ok, false);

    // 6. Rejeita stream que ultrapassa MAX_DANFSE_PDF_BYTES mesmo sem Content-Length
    globalThis.fetch = (async () => {
      let sent = 0;
      const chunk = new Uint8Array(1024 * 1024); // 1 MB
      chunk.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent > MAX_DANFSE_PDF_BYTES) {
            controller.close();
            return;
          }
          sent += chunk.byteLength;
          controller.enqueue(chunk);
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      });
    }) as typeof fetch;

    const streamTooBig = await generateOfficialDanfsePdfLocal('http://localhost:8082', validXml);
    assert.equal(streamTooBig.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('18. MÉDIO-03: public/sw.js bypasses local API paths (/health, /actuator, /danfse) and returns 503 Response offline instead of undefined', async () => {
  const swSource = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
  const listeners: Record<string, (event: unknown) => void> = {};

  const sandbox = {
    self: {
      location: { origin: 'http://localhost:3000' },
      addEventListener(type: string, handler: (event: unknown) => void) {
        listeners[type] = handler;
      },
      skipWaiting: async () => undefined,
      clients: { claim: async () => undefined },
    },
    caches: {
      match: async () => undefined,
      open: async () => ({
        put: async () => undefined,
        addAll: async () => undefined,
      }),
      keys: async () => [],
      delete: async () => true,
    },
    fetch: async () => {
      throw new TypeError('Offline network error');
    },
    URL,
    Response,
  };

  runInNewContext(swSource, sandbox);
  assert.equal(typeof listeners.fetch, 'function');

  // Endpoints de API local não podem ser interceptados pelo SW
  for (const apiPath of ['/health', '/health/live', '/actuator', '/actuator/health', '/danfse', '/danfse/pdf']) {
    let intercepted = false;
    listeners.fetch({
      request: { method: 'GET', url: `http://localhost:3000${apiPath}`, mode: 'cors' },
      respondWith() {
        intercepted = true;
      },
    });
    assert.equal(intercepted, false, `SW não deve interceptar ${apiPath}`);
  }

  // Asset estático sem cache offline deve retornar Response 503 (nunca undefined)
  let staticPromise: Promise<unknown> | null = null;
  listeners.fetch({
    request: { method: 'GET', url: 'http://localhost:3000/assets/missing.js', mode: 'cors' },
    respondWith(p: Promise<unknown>) {
      staticPromise = p;
    },
  });
  assert.ok(staticPromise !== null);
  const offlineAssetResponse = await (staticPromise as Promise<unknown>);
  assert.ok(offlineAssetResponse instanceof Response);
  assert.equal((offlineAssetResponse as Response).status, 503);
  assert.equal(await (offlineAssetResponse as Response).text(), 'Offline');
});
