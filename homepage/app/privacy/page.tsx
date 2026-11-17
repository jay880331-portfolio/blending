import type { Metadata } from "next";
import Link from "next/link";

const CONTACT_EMAIL = "blending-880331@kakao.com";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | BLENDING",
  description: "BLENDING 서비스의 개인정보 처리방침입니다.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <a className="skip-link" href="#privacy-content">
        본문으로 건너뛰기
      </a>

      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="BLENDING 홈">
          BLENDING
        </Link>
        <nav className="site-nav" aria-label="페이지 메뉴">
          <Link href="/">홈으로</Link>
        </nav>
        <span className="header-index" aria-hidden="true">POLICY</span>
      </header>

      <main id="privacy-content" className="policy-page" tabIndex={-1}>
        <header className="policy-hero">
          <div>
            <p className="eyebrow">PRIVACY POLICY</p>
            <h1>개인정보 처리방침</h1>
          </div>
          <div className="policy-summary">
            <p>BLENDING은 이용자의 개인정보를 소중히 다루며, 관련 법령을 준수합니다.</p>
            <p>시행일: 2026년 7월 30일</p>
          </div>
        </header>

        <article className="policy-content">
          <section>
            <h2>1. 수집하는 개인정보</h2>
            <p>서비스 이용 과정에서 아래 정보가 필수 또는 선택적으로 수집될 수 있습니다.</p>
            <ul>
              <li>계정 정보: 휴대전화번호, 비밀번호, 이름</li>
              <li>소셜 로그인 정보: 카카오·네이버·Apple 계정 식별자, 이름 또는 이메일</li>
              <li>프로필 정보: 닉네임, 프로필 사진, 소개, 역할, 경력, 자격·수상 이력, 근무지와 소셜 링크</li>
              <li>서비스 활동 정보: 게시물, 댓글, 리뷰, 포트폴리오, 메시지, 좋아요와 즐겨찾기</li>
              <li>위치 정보: 이용자가 위치 기능을 허용한 경우 현재 위치 및 등록한 근무지의 주소·좌표</li>
              <li>기기 및 이용 정보: 푸시 알림 토큰, 접속 기록, 오류 및 서비스 이용 기록</li>
            </ul>
          </section>

          <section>
            <h2>2. 개인정보 이용 목적</h2>
            <ul>
              <li>회원 가입, 본인 확인, 로그인 및 계정 관리</li>
              <li>프로필·포트폴리오·커뮤니티·메시지 기능 제공</li>
              <li>주변 커피인 및 관련 위치 기반 기능 제공</li>
              <li>알림 발송, 문의 대응, 서비스 안정성 확보와 부정 이용 방지</li>
              <li>서비스 품질 개선 및 법적 의무 이행</li>
            </ul>
          </section>

          <section>
            <h2>3. 개인정보의 제3자 제공 및 처리 위탁</h2>
            <p>BLENDING은 이용자의 동의 또는 법령상 근거 없이 개인정보를 제3자에게 판매하거나 제공하지 않습니다. 서비스 제공을 위해 호스팅, 데이터 저장, 이미지 저장, 본인 인증·문자 발송, 지도, 소셜 로그인 및 푸시 알림 사업자가 개인정보를 처리할 수 있습니다. 이 경우 필요한 범위에서만 처리하도록 관리합니다.</p>
          </section>

          <section>
            <h2>4. 보유 기간 및 파기</h2>
            <p>개인정보는 회원 탈퇴 또는 처리 목적 달성 시 지체 없이 파기합니다. 다만 관계 법령에 따라 보존 의무가 있거나 분쟁·부정 이용 대응을 위해 필요한 경우에는 해당 목적과 기간에 한해 분리하여 보관한 뒤 파기합니다.</p>
          </section>

          <section>
            <h2>5. 이용자의 권리와 계정 삭제</h2>
            <p>이용자는 자신의 개인정보를 조회·수정하거나 처리 정지 및 삭제를 요청할 수 있습니다. 계정 삭제는 아래 이메일로 가입한 휴대전화번호와 함께 요청해 주세요. 본인 확인 후 계정과 관련 데이터를 삭제하고 결과를 안내합니다.</p>
            <ul>
              <li>삭제 대상: 계정 정보, 프로필과 경력, 게시물·댓글·리뷰, 포트폴리오와 업로드 파일, 메시지, 좋아요·즐겨찾기 및 알림 정보</li>
              <li>부분 삭제: 앱에서 직접 작성한 콘텐츠를 삭제하거나 아래 이메일로 특정 데이터의 삭제를 요청할 수 있습니다.</li>
              <li>추가 보관: 원칙적으로 별도 보관하지 않습니다. 관계 법령에 보존 의무가 있는 기록만 법정 기간 동안 분리 보관한 뒤 파기합니다.</li>
            </ul>
            <p>요청 이메일: <a className="policy-mail" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
          </section>

          <section>
            <h2>6. 기기 권한</h2>
            <p>위치, 카메라·사진 및 알림 권한은 관련 기능을 사용할 때만 요청합니다. 권한을 허용하지 않아도 해당 기능을 제외한 서비스를 이용할 수 있으며, 기기 설정에서 언제든 권한을 변경할 수 있습니다.</p>
          </section>

          <section>
            <h2>7. 개인정보 보호와 문의</h2>
            <p>BLENDING은 접근 권한 관리, 전송 구간 보호 등 합리적인 보호조치를 적용합니다. 개인정보 처리에 관한 문의는 아래 이메일로 보내 주세요.</p>
            <p>개인정보 보호 문의: <a className="policy-mail" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
          </section>

          <section>
            <h2 id="child-safety">8. 아동 안전 및 CSAE 대응 표준</h2>
            <p>BLENDING은 아동 성적 학대 및 착취(CSAE), 아동 성적 학대 콘텐츠(CSAM), 그루밍, 성적 유인과 관련된 콘텐츠 및 행위를 엄격히 금지하며 무관용 원칙을 적용합니다.</p>
            <ul>
              <li>이용자는 게시물·댓글·사용자 프로필의 신고 기능을 통해 아동 안전 우려사항을 신고할 수 있습니다.</li>
              <li>신고된 콘텐츠는 신속히 검토하며, 위반 콘텐츠 삭제와 계정 이용 제한 또는 영구 정지 등의 조치를 시행합니다.</li>
              <li>관련 증거를 필요한 범위에서 보존하고, 적용 법령에 따라 관계 기관에 신고하며 조사에 협조합니다.</li>
              <li>긴급한 아동 안전 신고 또는 정책 문의는 아래 개인정보 보호 문의 이메일로 접수합니다.</li>
            </ul>
          </section>

          <section>
            <h2>9. 방침 변경</h2>
            <p>이 방침이 변경되는 경우 시행 전에 서비스 또는 이 페이지를 통해 안내합니다.</p>
          </section>
        </article>
      </main>

      <footer className="site-footer">
        <span className="wordmark">BLENDING</span>
        <small>© {new Date().getFullYear()} BLENDING. All rights reserved.</small>
        <Link href="/">홈으로</Link>
      </footer>
    </>
  );
}
