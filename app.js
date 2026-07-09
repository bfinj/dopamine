let QUESTIONS = {};

const DB_NAME = 'topik-db';
const DB_VERSION = 1;
const QUESTION_STORE = 'questions';

const state = {
  level: 'beginner',
  mode: 'practice',
  practiceIndex: 0,
  practiceSubmitted: false,
  mockIndex: 0,
  mockSubmitted: false,
  mockQuestions: [],
  answers: {},
  favorites: [],
  wrongBook: [],
  reviewWrongOnly: false,
  reviewFavoritesOnly: false
};

const elements = {
  levelSelect: document.getElementById('levelSelect'),
  tabs: document.querySelectorAll('.tab'),
  questionArea: document.getElementById('questionArea'),
  favoritesList: document.getElementById('favoritesList'),
  wrongList: document.getElementById('wrongList'),
  wrongBookTitle: document.getElementById('wrongBookTitle'),
  favoritesTitle: document.getElementById('favoritesTitle')
};

async function init() {
  await loadQuestions();
  const saved = JSON.parse(localStorage.getItem('topik-app-state') || '{}');
  state.level = saved.level || 'beginner';
  state.mode = saved.mode || 'practice';
  state.practiceIndex = saved.practiceIndex || 0;
  state.favorites = saved.favorites || [];
  state.wrongBook = saved.wrongBook || [];
  state.answers = saved.answers || {};
  state.reviewWrongOnly = saved.reviewWrongOnly || false;
  state.reviewFavoritesOnly = saved.reviewFavoritesOnly || false;
  elements.levelSelect.value = state.level;
  document.querySelector(`[data-mode="${state.mode}"]`).classList.add('active');
  render();
}

async function loadQuestions() {
  try {
    const response = await fetch('./data/questions.json');
    if (!response.ok) {
      throw new Error('Failed to load questions');
    }
    const payload = await response.json();
    QUESTIONS = payload;
    await saveQuestionsToDB(payload);
  } catch (error) {
    const data = await readQuestionsFromDB();
    if (data) {
      QUESTIONS = data;
    } else {
      QUESTIONS = { beginner: [], advanced: [] };
    }
  }
}

function openQuestionsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(QUESTION_STORE)) {
        db.createObjectStore(QUESTION_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readQuestionsFromDB() {
  return new Promise(async (resolve) => {
    try {
      const db = await openQuestionsDB();
      const transaction = db.transaction(QUESTION_STORE, 'readonly');
      const store = transaction.objectStore(QUESTION_STORE);
      const request = store.get('all');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    } catch (error) {
      resolve(null);
    }
  });
}

function saveQuestionsToDB(payload) {
  return new Promise(async (resolve) => {
    try {
      const db = await openQuestionsDB();
      const transaction = db.transaction(QUESTION_STORE, 'readwrite');
      const store = transaction.objectStore(QUESTION_STORE);
      const request = store.put(payload, 'all');
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (error) {
      resolve(false);
    }
  });
}

function saveState() {
  localStorage.setItem('topik-app-state', JSON.stringify({
    level: state.level,
    mode: state.mode,
    practiceIndex: state.practiceIndex,
    favorites: state.favorites,
    wrongBook: state.wrongBook,
    answers: state.answers,
    reviewWrongOnly: state.reviewWrongOnly,
    reviewFavoritesOnly: state.reviewFavoritesOnly
  }));
}

function getQuestions() {
  return QUESTIONS[state.level];
}

function getPracticeQuestions() {
  const questions = getQuestions();
  if (state.reviewWrongOnly) {
    return questions.filter((question) => state.wrongBook.includes(question.id));
  }
  if (state.reviewFavoritesOnly) {
    return questions.filter((question) => state.favorites.includes(question.id));
  }
  return questions;
}

function getCurrentQuestion() {
  if (state.mode === 'practice') {
    const questions = getPracticeQuestions();
    return questions[state.practiceIndex] || null;
  }
  return state.mockQuestions[state.mockIndex];
}

function render() {
  renderTabs();
  renderQuestion();
  renderSidebars();
}

function renderTabs() {
  elements.tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === state.mode);
  });
}

function renderQuestion() {
  const question = getCurrentQuestion();
  if (!question) {
    elements.questionArea.innerHTML = state.mode === 'practice' && (state.reviewWrongOnly || state.reviewFavoritesOnly)
      ? '<p class="empty">当前列表为空，先做题或收藏后再来复习吧。</p>'
      : '<p class="empty">暂无题目，请切换级别。</p>';
    return;
  }

  const selected = state.answers[question.id];
  const submitted = state.mode === 'practice' ? state.practiceSubmitted : state.mockSubmitted;
  const isFavorite = state.favorites.includes(question.id);

  const optionsHtml = question.options.map((option, index) => {
    let className = 'option';
    if (submitted) {
      if (index === question.answer) className += ' correct';
      else if (selected === index) className += ' wrong';
    } else if (selected === index) {
      className += ' selected';
    }
    return `<button class="${className}" data-index="${index}">${option}</button>`;
  }).join('');

  const actionHtml = state.mode === 'practice'
    ? `
      <div class="action-row">
        <button class="action-btn" id="submitBtn">提交答案</button>
        <button class="favorite-btn ${isFavorite ? 'active' : ''}" id="favoriteBtn">${isFavorite ? '★ 已收藏' : '☆ 收藏'}</button>
        <button class="action-btn" id="nextBtn">下一题</button>
      </div>
    `
    : `
      <div class="action-row">
        ${state.mockIndex > 0 ? '<button class="action-btn" id="prevBtn">上一题</button>' : ''}
        ${state.mockIndex < state.mockQuestions.length - 1
          ? '<button class="action-btn" id="nextBtn">下一题</button>'
          : '<button class="action-btn" id="submitBtn">交卷</button>'}
        <button class="favorite-btn ${isFavorite ? 'active' : ''}" id="favoriteBtn">${isFavorite ? '★ 已收藏' : '☆ 收藏'}</button>
      </div>
    `;

  const resultHtml = submitted
    ? `
      <div class="result-box ${selected === question.answer ? 'correct' : 'wrong'}">
        <strong>正确答案：</strong>${question.options[question.answer]}<br />
        <strong>解析：</strong>${question.explanation}
      </div>
    `
    : '';

  elements.questionArea.innerHTML = `
    <div class="question-meta">${state.level === 'beginner' ? 'TOPIK 初级' : 'TOPIK 中高级'} · ${state.mode === 'practice' ? '刷题练习' : '模拟考试'}</div>
    <h2 class="question-title">${question.prompt}</h2>
    <div class="option-list">${optionsHtml}</div>
    ${actionHtml}
    ${resultHtml}
  `;

  bindEvents();
}

function bindEvents() {
  elements.questionArea.querySelectorAll('.option').forEach((button) => {
    button.addEventListener('click', () => {
      if (state.mode === 'practice' && state.practiceSubmitted) return;
      const question = getCurrentQuestion();
      state.answers[question.id] = Number(button.dataset.index);
      saveState();
      render();
    });
  });

  const submitBtn = elements.questionArea.querySelector('#submitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const question = getCurrentQuestion();
      if (state.answers[question.id] === undefined) {
        alert('请先选择一个答案。');
        return;
      }
      if (state.mode === 'practice') {
        evaluatePracticeAnswer(question);
      } else {
        evaluateMockAnswer();
      }
    });
  }

  const nextBtn = elements.questionArea.querySelector('#nextBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (state.mode === 'practice') {
        state.practiceSubmitted = false;
        const questions = getPracticeQuestions();
        if (questions.length === 0) {
          saveState();
          render();
          return;
        }
        if (state.practiceIndex < questions.length - 1) {
          state.practiceIndex += 1;
        } else {
          state.practiceIndex = 0;
        }
      } else {
        if (state.mockIndex < state.mockQuestions.length - 1) {
          state.mockIndex += 1;
        }
      }
      saveState();
      render();
    });
  }

  const prevBtn = elements.questionArea.querySelector('#prevBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.mockIndex > 0) {
        state.mockIndex -= 1;
      }
      saveState();
      render();
    });
  }

  const favoriteBtn = elements.questionArea.querySelector('#favoriteBtn');
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', () => {
      const question = getCurrentQuestion();
      if (!question) return;
      if (state.favorites.includes(question.id)) {
        state.favorites = state.favorites.filter((id) => id !== question.id);
      } else {
        state.favorites.push(question.id);
      }
      saveState();
      render();
    });
  }
}

function evaluatePracticeAnswer(question) {
  state.practiceSubmitted = true;
  const selected = state.answers[question.id];
  if (selected !== question.answer) {
    if (!state.wrongBook.includes(question.id)) state.wrongBook.push(question.id);
  } else {
    state.wrongBook = state.wrongBook.filter((id) => id !== question.id);
  }
  saveState();
  render();
}

function evaluateMockAnswer() {
  const questions = state.mockQuestions;
  const current = questions[state.mockIndex];
  const selected = state.answers[current.id];
  if (selected === undefined) {
    alert('请先选择一个答案。');
    return;
  }
  if (state.mockIndex === questions.length - 1) {
    state.mockSubmitted = true;
    for (const item of questions) {
      const answer = state.answers[item.id];
      if (answer !== item.answer) {
        if (!state.wrongBook.includes(item.id)) state.wrongBook.push(item.id);
      } else {
        state.wrongBook = state.wrongBook.filter((id) => id !== item.id);
      }
    }
    saveState();
    renderMockSummary();
    return;
  }
  state.mockIndex += 1;
  saveState();
  render();
}

function renderMockSummary() {
  const questions = state.mockQuestions;
  const summaryHtml = questions.map((question) => {
    const selected = state.answers[question.id];
    const isCorrect = selected === question.answer;
    return `
      <div class="result-box ${isCorrect ? 'correct' : 'wrong'}">
        <strong>${question.prompt}</strong><br />
        你的答案：${selected !== undefined ? question.options[selected] : '未作答'}<br />
        正确答案：${question.options[question.answer]}<br />
        解析：${question.explanation}
      </div>
    `;
  }).join('');

  elements.questionArea.innerHTML = `
    <div class="question-meta">模拟考试已结束</div>
    <h2 class="question-title">本次成绩已生成，查看答案与解析。</h2>
    <div class="question-area">${summaryHtml}</div>
    <div class="action-row">
      <button class="action-btn" id="restartBtn">重新开始</button>
    </div>
  `;

  document.getElementById('restartBtn').addEventListener('click', () => {
    state.mockSubmitted = false;
    state.mockIndex = 0;
    state.mockQuestions = shuffle(getQuestions()).slice(0, 6);
    saveState();
    render();
  });
}

function renderSidebars() {
  const currentLevelQuestions = getQuestions();
  const favoriteQuestions = state.favorites
    .map((id) => currentLevelQuestions.find((item) => item.id === id))
    .filter(Boolean);

  elements.favoritesList.innerHTML = favoriteQuestions.length
    ? favoriteQuestions.map((question, index) => `<li><button data-favorite-index="${index}">${question.prompt}</button></li>`).join('')
    : '<li class="empty">还没有收藏题目。</li>';

  elements.favoritesList.querySelectorAll('button[data-favorite-index]').forEach((button) => {
    button.addEventListener('click', () => {
      enterFavoriteReview(Number(button.dataset.favoriteIndex));
    });
  });

  const wrongQuestions = state.wrongBook
    .map((id) => currentLevelQuestions.find((item) => item.id === id))
    .filter(Boolean);

  elements.wrongList.innerHTML = wrongQuestions.length
    ? wrongQuestions.map((question, index) => `<li><button data-wrong-index="${index}">${question.prompt}</button></li>`).join('')
    : '<li class="empty">错题本是空的，继续加油。</li>';

  elements.wrongList.querySelectorAll('button[data-wrong-index]').forEach((button) => {
    button.addEventListener('click', () => {
      enterWrongBookReview(Number(button.dataset.wrongIndex));
    });
  });
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function enterWrongBookReview(index = 0) {
  state.mode = 'practice';
  state.reviewWrongOnly = true;
  state.reviewFavoritesOnly = false;
  state.practiceSubmitted = false;
  state.practiceIndex = index;
  state.mockSubmitted = false;
  state.mockIndex = 0;
  saveState();
  render();
}

function enterFavoriteReview(index = 0) {
  state.mode = 'practice';
  state.reviewWrongOnly = false;
  state.reviewFavoritesOnly = true;
  state.practiceSubmitted = false;
  state.practiceIndex = index;
  state.mockSubmitted = false;
  state.mockIndex = 0;
  saveState();
  render();
}

function switchMode(mode) {
  state.mode = mode;
  state.reviewWrongOnly = false;
  state.reviewFavoritesOnly = false;
  state.practiceSubmitted = false;
  state.mockSubmitted = false;
  state.mockIndex = 0;
  if (mode === 'mock') {
    state.mockQuestions = shuffle(getQuestions()).slice(0, 6);
  }
  saveState();
  render();
}

function attachEvents() {
  elements.levelSelect.addEventListener('change', (event) => {
    state.level = event.target.value;
    state.practiceIndex = 0;
    state.practiceSubmitted = false;
    state.mockQuestions = shuffle(getQuestions()).slice(0, 6);
    state.mockIndex = 0;
    state.mockSubmitted = false;
    saveState();
    render();
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  elements.wrongBookTitle.addEventListener('click', () => enterWrongBookReview());
  elements.favoritesTitle.addEventListener('click', () => enterFavoriteReview());
}

attachEvents();
init();
