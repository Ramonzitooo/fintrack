import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RTC_TRANSITION_SCHEDULE,
  RTC_REDUCTION_PRESETS,
  SIMPLES_ANEXOS,
  MAX_NFSE_XML_BYTES,
  getRtcScheduleForYear,
  calculateRegimeRegularRtc,
  calculateSimplesNacionalRtc,
  parseNfseXml,
} from './taxRtcMath.ts';
import {
  DEFAULT_LOCAL_RTC_ENDPOINTS,
  isAllowedLocalRtcUrl,
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
    assert.equal(parsedNac.data.discriminacao, 'Consultoria <TI> & Arquitetura');
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
