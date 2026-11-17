const SERVICE_URL = "https://blending.ridge-it.site";
const CONTACT_EMAIL = "blending-880331@kakao.com";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#content">
        본문으로 건너뛰기
      </a>

      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="BLENDING 홈">
          BLENDING
        </a>
        <nav className="site-nav" aria-label="주요 메뉴">
          <a href="#about">회사 소개</a>
          <a href="#product">Blending</a>
          <a href="#contact">문의</a>
        </nav>
        <span className="header-index" aria-hidden="true">
          01 / 04
        </span>
      </header>

      <main id="content" tabIndex={-1}>
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-main">
            <p className="eyebrow">COFFEE, PEOPLE, EXPERIENCE</p>
            <h1 id="hero-title">
              더 좋은 커피 경험을
              <br /> 사람과 연결합니다.
            </h1>
            <p className="hero-copy">
              BLENDING은 커피를 좋아하는 사람들이 발견하고, 배우고, 연결되는
              경험을 만듭니다.
            </p>
            <div className="hero-actions">
              <a
                className="button button-primary"
                href={SERVICE_URL}
                target="_blank"
                rel="noreferrer"
              >
                서비스 시작하기 <span aria-hidden="true">↗</span>
              </a>
              <a className="button button-secondary" href="#about">
                회사 소개
              </a>
            </div>
          </div>
          <aside className="hero-note" aria-label="BLENDING 소개">
            <span className="section-number">01</span>
            <p>
              좋아하는 한 잔에서 시작해, 매일의 기록과 사람 사이의 대화로
              이어지는 커피 커뮤니티.
            </p>
            <span className="note-rule" aria-hidden="true" />
            <small>SEOUL · KOREA</small>
          </aside>
        </section>

        <section className="showcase" id="product" aria-labelledby="product-title">
          <div className="section-intro">
            <div>
              <p className="eyebrow">OUR PRODUCT</p>
              <h2 id="product-title">취향에서 시작되는 커피 커뮤니티</h2>
            </div>
            <p>
              일정, 레시피, 질문과 답변을 하나의 흐름으로 연결해 매일의 커피
              생활을 더 풍부하게 만듭니다.
            </p>
          </div>

          <div className="product-stage" aria-label="Blending 서비스 화면 미리보기">
            <div className="workspace-sidebar" aria-hidden="true">
              <span className="mini-wordmark">BLENDING</span>
              <span className="workspace-active">HOME</span>
              <span>CALENDAR</span>
              <span>RECIPE</span>
              <span>Q&amp;A</span>
              <small>07:30 AM</small>
            </div>
            <div className="workspace-content">
              <div className="workspace-heading">
                <p className="workspace-label">THIS WEEK&apos;S POUR</p>
                <h3>이번 주, 커피로 만나는 새로운 장면</h3>
                <span className="workspace-count">03 STORIES</span>
              </div>
              <div className="feature-grid">
                <article className="feature feature-calendar">
                  <span className="feature-number">01 / CALENDAR</span>
                  <div>
                    <h4>서울 로스터리 투어</h4>
                    <p>좋아하는 한 잔을 만드는 사람과 공간을 만나보세요.</p>
                  </div>
                  <span className="feature-date">SAT · 17</span>
                </article>
                <article className="feature feature-recipe">
                  <span className="feature-number">02 / RECIPE</span>
                  <div>
                    <h4>오늘의 브루잉 노트</h4>
                    <p>나만의 레시피를 기록하고 새로운 취향을 발견하세요.</p>
                  </div>
                  <dl>
                    <div><dt>BEANS</dt><dd>18g</dd></div>
                    <div><dt>WATER</dt><dd>270g</dd></div>
                  </dl>
                </article>
                <article className="feature feature-qa">
                  <span className="feature-number">03 / Q&amp;A</span>
                  <div>
                    <h4>커피 Q&amp;A</h4>
                    <p>궁금했던 커피 이야기를 동료들과 나눠보세요.</p>
                  </div>
                  <span className="feature-arrow" aria-hidden="true">↗</span>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="about" id="about" aria-labelledby="about-title">
          <div className="about-label">
            <p className="eyebrow">ABOUT BLENDING</p>
            <span className="section-number">02</span>
          </div>
          <div className="about-grid">
            <h2 id="about-title">좋아하는 마음이 오래 이어지는 제품을 만듭니다.</h2>
            <div className="about-copy">
              <p>
                우리는 기술보다 경험을 먼저 봅니다. 쓰기 쉽고, 다시 찾고 싶고,
                사람 사이의 대화를 자연스럽게 만드는 제품을 지향합니다.
              </p>
              <dl className="principles">
                <div><dt>01</dt><dd>명확하고 단순하게</dd></div>
                <div><dt>02</dt><dd>사용자의 맥락에서</dd></div>
                <div><dt>03</dt><dd>오래 쓸 수 있도록</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section className="contact" id="contact" aria-labelledby="contact-title">
          <div>
            <p className="eyebrow">WORK WITH US</p>
            <h2 id="contact-title">함께 만들고 싶은 이야기가 있나요?</h2>
          </div>
          <div className="contact-copy">
            <p>제품, 콘텐츠, 커피에 관한 좋은 협업 제안을 기다립니다.</p>
            <a className="contact-link" href={`mailto:${CONTACT_EMAIL}`}>
              협업 문의 <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span className="wordmark">BLENDING</span>
        <small>© {new Date().getFullYear()} BLENDING. All rights reserved.</small>
        <a href="/privacy">개인정보 처리방침</a>
      </footer>
    </>
  );
}
