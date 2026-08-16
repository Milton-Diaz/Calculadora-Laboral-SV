const $ = (id) => document.getElementById(id);

const sectorData = {
  comercio: { name: "Comercio, industria y servicios", minimum: 408.80 },
  maquila: { name: "Maquila textil y confección", minimum: 402.32 },
  agricola: { name: "Agropecuario", minimum: 305.23 }
};

function money(n){
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n)||0);
}
function num(id){
  const v = parseFloat($(id).value);
  return Number.isFinite(v) ? v : 0;
}
function clamp0(n){ return Math.max(0, Number(n)||0); }

function updateProgress(){
  const required = [$("salario"),$("anios"),$("meses")];
  let done = required.filter(x => x.value !== "").length;
  const extra = ["horasDiurnas","horasNocturnas","asuetos","descansos"].some(id => num(id)>0);
  if(extra) done += 1;
  const pct = Math.round((done/4)*100);
  $("progressBar").style.width = pct + "%";
  $("progressText").textContent = pct + "%";
}

document.querySelectorAll("input,select").forEach(el => el.addEventListener("input",updateProgress));
document.querySelectorAll('input[name="tipoCierre"]').forEach(el => el.addEventListener("change",()=>{
  $("renunciaNotice").classList.toggle("hidden", document.querySelector('input[name="tipoCierre"]:checked').value !== "renuncia");
  updateProgress();
}));

$("noAplica").addEventListener("change",()=>{
  ["horasDiurnas","horasNocturnas","asuetos","descansos"].forEach(id=>{
    $(id).disabled = $("noAplica").checked;
    if($("noAplica").checked) $(id).value = 0;
  });
  updateProgress();
});

function valid(){
  let ok = true;
  [$("salario"),$("anios"),$("meses")].forEach(el=>el.classList.remove("invalid"));
  const salario=num("salario"), anios=num("anios"), meses=num("meses");
  if(salario<=0){$("salario").classList.add("invalid");ok=false}
  if(!Number.isInteger(anios)||anios<0){$("anios").classList.add("invalid");ok=false}
  if(!Number.isInteger(meses)||meses<0||meses>11){$("meses").classList.add("invalid");ok=false}
  if(!ok) showToast("Revisa los campos obligatorios marcados.");
  return ok;
}

function calculate(){
  if(!valid()) return;

  const salario = num("salario");
  const anios = num("anios");
  const meses = num("meses");
  const fraccion = meses/12;
  const antiguedad = anios + fraccion;
  const salarioDiario = salario/30;
  const salarioHora = salarioDiario/8;
  const sector = sectorData[$("sector").value];
  const tipo = document.querySelector('input[name="tipoCierre"]:checked').value;

  // Vacación proporcional: 15 días + 30%, proporcional a la fracción anual indicada.
  const vacaciones = salarioDiario * 15 * 1.30 * fraccion;

  // Aguinaldo: tabla legal por antigüedad. Con este formulario se estima la parte
  // proporcional usando los meses adicionales; para cálculo oficial se requieren fechas exactas.
  let diasAguinaldo;
  if(antiguedad < 1) diasAguinaldo = 15;
  else if(antiguedad < 3) diasAguinaldo = 15;
  else if(antiguedad < 10) diasAguinaldo = 19;
  else diasAguinaldo = 21;
  const aguinaldo = salarioDiario * diasAguinaldo * fraccion;

  // Indemnización / compensación.
  const minimoDiario = sector.minimum/30;
  let prestacion = 0;
  let indLabel, indHelp;

  if(tipo === "despido"){
    // Art. 58: 30 días por año, proporcional por fracciones; mínimo 15 días.
    const base = Math.min(salarioDiario, minimoDiario*4);
    prestacion = base * 30 * antiguedad;
    prestacion = Math.max(prestacion, base*15);
    indLabel = "Indemnización por despido";
    indHelp = `Base diaria limitada a 4 × salario mínimo diario (${money(minimoDiario*4)}).`;
  }else{
    // Ley de Renuncia Voluntaria: desde 2 años; 15 días por año; máximo 2 × salario mínimo diario.
    const base = Math.min(salarioDiario, minimoDiario*2);
    if(antiguedad >= 2) prestacion = base * 15 * antiguedad;
    indLabel = "Compensación por renuncia";
    indHelp = antiguedad >= 2
      ? `Base diaria limitada a 2 × salario mínimo diario (${money(minimoDiario*2)}).`
      : "No se genera compensación legal por no alcanzar 2 años de servicio.";
  }

  const diurnasHoras = $("noAplica").checked ? 0 : clamp0(num("horasDiurnas"));
  const nocturnasHoras = $("noAplica").checked ? 0 : clamp0(num("horasNocturnas"));
  const asuetosDias = $("noAplica").checked ? 0 : clamp0(num("asuetos"));
  const descansosDias = $("noAplica").checked ? 0 : clamp0(num("descansos"));

  // MTPS: extra diurna = hora + 100% = 2x.
  const pagoDiurnas = diurnasHoras * salarioHora * 2;

  // MTPS: extra nocturna = hora + 100% + 25% nocturnidad.
  const pagoNocturnas = nocturnasHoras * salarioHora * 2 * 1.25;

  // Asueto laborado = jornada ordinaria + 100% de recargo = 2x.
  const pagoAsuetos = asuetosDias * salarioDiario * 2;

  // Descanso semanal: base ordinaria + recargo mínimo 50%.
  const pagoDescansos = descansosDias * salarioDiario * 1.5;

  const total = vacaciones + aguinaldo + prestacion + pagoDiurnas + pagoNocturnas + pagoAsuetos + pagoDescansos;

  $("rSalario").textContent = money(salario);
  $("rDiario").textContent = money(salarioDiario);
  $("rAntiguedad").textContent = `${anios} año(s), ${meses} mes(es)`;
  $("rCausa").textContent = tipo === "despido" ? "Despido injustificado" : "Renuncia voluntaria";
  $("rVacaciones").textContent = money(vacaciones);
  $("rAguinaldo").textContent = money(aguinaldo);
  $("indLabel").textContent = indLabel;
  $("indHelp").textContent = indHelp;
  $("rIndemnizacion").textContent = money(prestacion);
  $("rDiurnas").textContent = money(pagoDiurnas);
  $("rNocturnas").textContent = money(pagoNocturnas);
  $("rAsuetos").textContent = money(pagoAsuetos);
  $("rDescansos").textContent = money(pagoDescansos);
  $("rTotal").textContent = money(total);
  $("resultSubtitle").textContent = `Sector: ${sector.name}. Resultado informativo generado con los datos ingresados.`;

  const lines = [
    `Salario diario: ${money(salario)} ÷ 30 = ${money(salarioDiario)}.`,
    `Vacación proporcional: ${money(salarioDiario)} × 15 × 1.30 × (${meses}/12) = ${money(vacaciones)}.`,
    `Aguinaldo: ${diasAguinaldo} días × ${money(salarioDiario)} × (${meses}/12) = ${money(aguinaldo)}.`,
    tipo === "despido"
      ? `Indemnización: ${money(Math.min(salarioDiario,minimoDiario*4))} × 30 × ${antiguedad.toFixed(2)} años = ${money(prestacion)}.`
      : `Renuncia: ${antiguedad >= 2 ? money(Math.min(salarioDiario,minimoDiario*2)) + " × 15 × " + antiguedad.toFixed(2) + " años" : "0 por no cumplir 2 años"} = ${money(prestacion)}.`,
    `Horas diurnas: ${diurnasHoras} h × ${money(salarioHora*2)} = ${money(pagoDiurnas)}.`,
    `Horas nocturnas: ${nocturnasHoras} h × ${money(salarioHora*2*1.25)} = ${money(pagoNocturnas)}.`,
    `Asuetos: ${asuetosDias} día(s) × ${money(salarioDiario*2)} = ${money(pagoAsuetos)}.`,
    `Descanso semanal: ${descansosDias} día(s) × ${money(salarioDiario*1.5)} = ${money(pagoDescansos)}.`
  ];
  $("calculationDetails").innerHTML = lines.map(x=>`<div class="calc-line">${x}</div>`).join("");

  $("results").classList.remove("hidden");
  $("results").scrollIntoView({behavior:"smooth",block:"start"});
}

$("calculatorForm").addEventListener("submit", e=>{e.preventDefault();calculate()});

$("clearBtn").addEventListener("click",()=>{
  $("calculatorForm").reset();
  ["horasDiurnas","horasNocturnas","asuetos","descansos"].forEach(id=>{
    $(id).disabled=false; $(id).value=0;
  });
  $("results").classList.add("hidden");
  $("renunciaNotice").classList.add("hidden");
  document.querySelector('input[name="tipoCierre"][value="despido"]').checked=true;
  updateProgress();
  window.scrollTo({top:0,behavior:"smooth"});
});

$("printBtn").addEventListener("click",()=>window.print());

function showToast(msg){
  $("toast").textContent=msg;
  $("toast").classList.add("show");
  setTimeout(()=>$("toast").classList.remove("show"),2600);
}

updateProgress();
