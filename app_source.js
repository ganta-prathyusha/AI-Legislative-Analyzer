var GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
var MODEL = 'llama-3.1-8b-instant';
var MAX_TOKENS = 5500;

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('analyzeBtn').addEventListener('click', runAnalyze);
  document.getElementById('pdfInput').addEventListener('change', function () {
    if (this.files && this.files[0]) loadPDF(this.files[0]);
  });
  var zone = document.getElementById('uploadZone');
  zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', function () { zone.classList.remove('dragover'); });
  zone.addEventListener('drop', function (e) {
    e.preventDefault(); zone.classList.remove('dragover');
    var f = e.dataTransfer.files[0];
    if (f && f.type === 'application/pdf') loadPDF(f); else showError('Drop a PDF file.');
  });
});

function loadPDF(file) {
  clearError(); setLoader(true, 'Reading ' + file.name + '...');
  var reader = new FileReader();
  reader.readAsArrayBuffer(file);
  reader.onload = function () {
    pdfjsLib.getDocument({ data: new Uint8Array(reader.result) }).promise.then(function (pdf) {
      var total = pdf.numPages, pages = [], loaded = 0;
      for (var i = 1; i <= total; i++) {
        (function (n) {
          pdf.getPage(n).then(function (page) {
            page.getTextContent().then(function (tc) {
              pages[n - 1] = tc.items.map(function (x) { return x.str; }).join(' ');
              if (++loaded === total) {
                var text = pages.join('\n').trim();
                if (!text) { showError('No text found.'); setLoader(false); return; }
                document.getElementById('legalText').value = text;
                var z = document.getElementById('uploadZone');
                z.classList.add('loaded');
                z.querySelector('.upload-icon').textContent = 'OK';
                z.querySelector('p').textContent = file.name + ' (' + total + ' pages)';
                var st = document.getElementById('pdfStatus');
                st.textContent = 'Extracted ' + estimateTokens(text).toLocaleString() + ' tokens. Ready.';
                st.classList.remove('hidden');
                setLoader(false);
              }
            });
          });
        })(i);
      }
    }).catch(function (e) { showError('PDF error: ' + e.message); setLoader(false); });
  };
  reader.onerror = function () { showError('File read error.'); setLoader(false); };
}

function runAnalyze() {
  var text = document.getElementById('legalText').value.trim();
  var apiKey = document.getElementById('apiKey').value.trim();
  var btn = document.getElementById('analyzeBtn');
  clearError();
  document.getElementById('output').classList.add('hidden');
  document.getElementById('statsBar').classList.add('hidden');
  if (text.length < 100) return showError('Upload a PDF or paste text first.');
  if (!apiKey.startsWith('gsk_')) return showError('Enter Groq API key (starts with gsk_). Free at console.groq.com');
  btn.disabled = true;
  var origT = estimateTokens(text);
  setLoader(true, 'Compressing ' + origT.toLocaleString() + ' tokens...');
  setTimeout(function () {
    try {
      var comp = compress(text, MAX_TOKENS);
      var compT = estimateTokens(comp);
      var ratio = ((1 - compT / origT) * 100).toFixed(1);
      var density = getDensity(text, comp, origT, compT);
      setLoader(true, 'Calling Groq (' + compT.toLocaleString() + ' tokens, ' + ratio + '% saved)...');
      callGroq(comp, apiKey)
        .then(function (d) { showStats(origT, compT, ratio, density); renderOutput(d); })
        .catch(function (e) { showError(e.message); })
        .finally(function () { btn.disabled = false; setLoader(false); });
    } catch (e) { showError('Error: ' + e.message); btn.disabled = false; setLoader(false); }
  }, 50);
}

function compress(text, target) {
  var clean = text.replace(/page\s+\d+\s+of\s+\d+/gi,'').replace(/^\s*\d+\s*$/gm,'').replace(/={3,}|-{3,}/g,'').replace(/\s{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  var segs = clean.split(/\n{2,}/).map(function(s){return s.trim();}).filter(function(s){return s.length>40;});
  var corpus = segs.map(tok);
  var idf = getIDF(corpus);
  var scored = segs.map(function(s,i){return{s:s,score:tfidf(corpus[i],idf)+legalBoost(s),i:i};});
  var dd = dedup(scored); dd.sort(function(a,b){return b.score-a.score;});
  var out=[],n=0;
  for(var i=0;i<dd.length;i++){var t=estimateTokens(dd[i].s);if(n+t<=target){out.push(dd[i]);n+=t;}}
  out.sort(function(a,b){return a.i-b.i;});
  return '[COMPRESSED]\n\n'+out.map(function(x){return x.s;}).join('\n---\n')+'\n\n[END]';
}

function tok(t){return t.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(function(w){return w.length>3&&!SW[w];});}
function getIDF(c){var df={},N=c.length,idf={};c.forEach(function(d){var s={};d.forEach(function(t){if(!s[t]){df[t]=(df[t]||0)+1;s[t]=1;}});});Object.keys(df).forEach(function(t){idf[t]=Math.log((N+1)/(df[t]+1))+1;});return idf;}
function tfidf(tokens,idf){if(!tokens.length)return 0;var tf={},sc=0;tokens.forEach(function(t){tf[t]=(tf[t]||0)+1;});Object.keys(tf).forEach(function(t){sc+=(tf[t]/tokens.length)*(idf[t]||1);});return sc;}
var LS=[/\bshall\b/i,/\bmust\b/i,/\bprohibit/i,/\bpenalt/i,/\bfine\b/i,/\bentitle/i,/\bright\b/i,/\bduty\b/i,/\bauthoriz/i,/\bestablish/i,/\bsection\s+\d/i,/\bamend/i,/\bnotwithstanding/i];
function legalBoost(s){return LS.filter(function(r){return r.test(s);}).length*0.3;}
function jac(a,b){var sa={},u={},n=0;a.forEach(function(x){sa[x]=1;u[x]=1;});b.forEach(function(x){if(sa[x])n++;u[x]=1;});var ul=Object.keys(u).length;return ul?n/ul:0;}
function dedup(sc){var r=[];sc.forEach(function(item){var t=tok(item.s);if(!r.some(function(x){return jac(tok(x.s),t)>0.6;}))r.push(item);});return r;}
function estimateTokens(t){return Math.ceil(t.length/4);}
function getDensity(orig,comp,oT,cT){var ot={},ct={};tok(orig).forEach(function(t){ot[t]=1;});tok(comp).forEach(function(t){ct[t]=1;});var os=Object.keys(ot).length||1;var ret=Object.keys(ct).filter(function(t){return ot[t];}).length;return((ret/os)*(oT/cT)).toFixed(2);}

function callGroq(prompt, key) {
  var sys = 'You are an AI Legislative Analyzer. Analyze the legal document extract. Respond ONLY with valid JSON, no markdown:\n{"title":"...","summary":"3-4 plain sentences","keyPoints":["5-7 items"],"impact":{"generalPublic":"...","businesses":"...","government":"..."},"advantages":["3-5 items"],"concerns":["3-5 items"],"verdict":"2-3 sentences"}';
  return fetch(GROQ_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:MODEL,messages:[{role:'system',content:sys},{role:'user',content:prompt}],temperature:0.2,max_tokens:1024})}).then(function(res){return res.json().then(function(data){if(!res.ok){var msg=(data.error&&data.error.message)||('Error '+res.status);if(res.status===401)throw new Error('Invalid API key');if(res.status===429)throw new Error('Rate limit. Wait and retry.');throw new Error(msg);}var raw=data.choices[0].message.content.trim();var m=raw.match(/\{[\s\S]*\}/);if(!m)throw new Error('Bad response. Try again.');return JSON.parse(m[0]);});});
}

function showStats(orig,comp,ratio,density){document.getElementById('statOriginal').textContent=orig.toLocaleString();document.getElementById('statCompressed').textContent=comp.toLocaleString();document.getElementById('statRatio').textContent=ratio+'% saved';document.getElementById('statDensity').textContent=density+'x';document.getElementById('statsBar').classList.remove('hidden');}

function renderOutput(d){
  var o=document.getElementById('output');
  o.innerHTML='<h2>'+(d.title||'Analysis')+'</h2><div class="section"><h3>Summary</h3><p>'+d.summary+'</p></div><div class="section"><h3>Key Points</h3><ul>'+(d.keyPoints||[]).map(function(p){return'<li>'+p+'</li>';}).join('')+'</ul></div><div class="section"><h3>Impact Analysis</h3><p><span class="tag">General Public</span>'+((d.impact||{}).generalPublic||'')+'</p><p><span class="tag">Businesses</span>'+((d.impact||{}).businesses||'')+'</p><p><span class="tag">Government</span>'+((d.impact||{}).government||'')+'</p></div><div class="section"><h3>Advantages</h3><ul>'+(d.advantages||[]).map(function(a){return'<li>'+a+'</li>';}).join('')+'</ul></div><div class="section"><h3>Concerns</h3><ul>'+(d.concerns||[]).map(function(c){return'<li>'+c+'</li>';}).join('')+'</ul></div><div class="section"><h3>Final Verdict</h3><div class="verdict-box">'+d.verdict+'</div></div>';
  o.classList.remove('hidden');
  o.scrollIntoView({behavior:'smooth'});
}

function setLoader(show,msg){if(msg)document.getElementById('loaderMsg').textContent=msg;document.getElementById('loader').classList.toggle('hidden',!show);}
function clearError(){document.getElementById('error').classList.add('hidden');}
function showError(msg){var el=document.getElementById('error');el.textContent=msg;el.classList.remove('hidden');}

var SW={'that':1,'this':1,'with':1,'from':1,'have':1,'been':1,'will':1,'which':1,'they':1,'them':1,'there':1,'these':1,'those':1,'such':1,'each':1,'also':1,'into':1,'upon':1,'under':1,'over':1,'after':1,'before':1,'about':1,'above':1,'below':1,'between':1,'through':1,'during':1,'within':1,'without':1,'against':1,'among':1,'along':1,'around':1,'beyond':1,'section':1,'subsection':1,'paragraph':1,'clause':1,'article':1,'thereof':1,'therein':1,'hereby':1,'hereto':1,'hereof':1,'hereunder':1,'said':1,'same':1,'other':1,'another':1,'further':1,'more':1,'less':1,'made':1,'make':1,'take':1,'give':1,'come':1,'goes':1,'went':1,'being':1,'when':1,'where':1,'what':1,'whom':1,'whose':1,'whether':1,'however':1,'therefore':1,'whereas':1,'provided':1,'including':1,'included':1,'includes':1};
