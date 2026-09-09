(() => {
  const dataNode = document.getElementById('golf-data');
  const data = dataNode ? JSON.parse(dataNode.textContent) : { courses: [] };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const menuButton = $('.menu-toggle');
  const mobileMenu = $('#mobile-menu');
  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    mobileMenu.hidden = open;
  });
  mobileMenu?.addEventListener('click', () => { mobileMenu.hidden = true; menuButton?.setAttribute('aria-expanded', 'false'); });

  const form = $('#booking-wizard');
  if (!form) return;
  let step = 1;
  const region = $('#booking-region');
  const course = $('#booking-course');
  const date = $('#booking-date');
  const undecided = $('#date-undecided');
  const error = $('#booking-error');
  const next = $('[data-booking-next]');
  const prev = $('[data-booking-prev]');
  const quote = $('[data-booking-quote]');
  const defaultDate = new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10);
  date.min = new Date().toISOString().slice(0, 10);
  date.value = defaultDate;

  function syncCourses() {
    const regionId = region.value;
    const options = data.courses.filter((item) => !regionId || item.region_id === regionId);
    course.innerHTML = `<option value="">골프장 선택</option>${options.map((item) => `<option value="${esc(item.course_id)}">${esc(item.name_ko)} · ${esc(item.region_ko)}</option>`).join('')}`;
  }
  region.addEventListener('change', syncCourses);
  undecided.addEventListener('change', () => { date.disabled = undecided.checked; if (undecided.checked) date.value = ''; });

  function fail(message) {
    error.textContent = message;
    error.hidden = false;
    return false;
  }
  function validateCurrent() {
    error.hidden = true;
    if (step === 1 && !undecided.checked && !date.value) return fail('라운드 날짜를 입력하거나 날짜 미정 상담을 선택하세요.');
    if (step === 1 && !region.value) return fail('희망 지역을 선택하세요.');
    if (step === 2 && !course.value) return fail('현지 확인할 골프장을 선택하세요.');
    if (step === 3 && !$('#booking-stay').value.trim()) return fail('픽업 동선을 확인할 숙소 또는 지역을 입력하세요.');
    return true;
  }
  function summary() {
    const selected = data.courses.find((item) => item.course_id === course.value);
    const rows = [
      ['날짜', undecided.checked ? '날짜 미정 상담' : date.value],
      ['골프장', selected ? `${selected.name_ko} · ${selected.region_ko}` : '미선택'],
      ['인원·시간', `${$('#booking-players').value}인 · ${$('#booking-time').value}`],
      ['픽업', `${$('#booking-stay').value} · 골프백 ${$('#booking-bags').value}개`],
      ['차량', $('#booking-vehicle').value],
      ['대체 조건', $('#booking-alternative').value]
    ];
    $('#booking-summary').innerHTML = rows.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
  }
  function showStep() {
    $$('.booking-step').forEach((node) => { node.hidden = Number(node.dataset.step) !== step; });
    $$('[data-step-dot]').forEach((node) => node.classList.toggle('active', Number(node.dataset.stepDot) <= step));
    prev.hidden = step === 1;
    next.hidden = step === 4;
    quote.hidden = step !== 4;
    if (step === 4) summary();
  }
  next.addEventListener('click', () => { if (validateCurrent()) { step += 1; showStep(); } });
  prev.addEventListener('click', () => { step = Math.max(1, step - 1); error.hidden = true; showStep(); });
  syncCourses();
  showStep();
})();
