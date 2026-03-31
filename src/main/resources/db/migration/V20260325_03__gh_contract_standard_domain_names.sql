UPDATE public.domains d
SET
    domain_group = CASE
        WHEN d.logical_name IN (
            '명',
            '내용',
            '설명',
            '의무',
            '장소',
            '제목',
            '주소',
            '직급',
            '직위',
            '임무내용',
            '작업구역',
            '훈련대상',
            '사용자정보',
            '안전보건대책',
            '유해위험요인',
            '이행평가 항목명',
            '적용 범위',
            '속성값_v1000',
            '명_V2000',
            '명_V500'
        ) THEN '명칭'
        WHEN d.logical_name IN (
            '공종아이디',
            '메뉴아이디',
            '부서아이디',
            '조직아이디',
            '추적아이디',
            '현장아이디',
            '사용자아이디',
            '결재소스아이디',
            '작업종류아이디',
            '코드그룹아이디',
            '파일문서아이디',
            '알림템플릿아이디',
            '파일업로드아이디',
            '이메일템플릿아이디',
            '파일 아이디',
            'sms 요청아이디',
            'SR아이디',
            '코드',
            '고유번호',
            '사업자등록번호'
        ) THEN '식별자'
        WHEN d.logical_name IN ('분', '수', '금액', '레벨', '순서', '점수', '횟수', '소요시간', '시퀀스값', '파일사이즈') THEN '수치'
        WHEN d.logical_name IN ('시간', '연도', '연월', '일시', '일자') THEN '일시'
        WHEN d.logical_name IN ('이메일', '전화번호', '파일경로', 'IP주소', 'URL') THEN '연락/경로'
        WHEN d.logical_name IN ('비밀번호', '비밀번호솔트', '초대토큰') THEN '보안'
        WHEN d.logical_name IN ('여부') THEN '여부/상태'
        WHEN d.logical_name IN ('JSONB') THEN '특수'
        ELSE d.domain_group
    END,
    domain_classification = d.logical_name,
    logical_name = REGEXP_REPLACE(d.logical_name, '[[:space:]]+', '', 'g')
        || '_'
        || LEFT(UPPER(d.data_type), 1)
        || COALESCE(d.data_length::text, '')
        || CASE
            WHEN d.data_scale IS NOT NULL THEN '_' || d.data_scale::text
            ELSE ''
        END
FROM public.dictionary_sets ds
WHERE ds.id = d.dictionary_set_id
  AND ds.name = 'GH 도급'
  AND d.logical_name IN (
      '명',
      '분',
      '수',
      '금액',
      '내용',
      '레벨',
      '설명',
      '순서',
      '시간',
      '여부',
      '연도',
      '연월',
      '의무',
      '일시',
      '일자',
      '장소',
      '점수',
      '제목',
      '주소',
      '직급',
      '직위',
      '코드',
      '횟수',
      '이메일',
      '고유번호',
      '비밀번호',
      '소요시간',
      '시퀀스값',
      '임무내용',
      '작업구역',
      '전화번호',
      '초대토큰',
      '파일경로',
      '훈련대상',
      '공종아이디',
      '메뉴아이디',
      '부서아이디',
      '사용자정보',
      '조직아이디',
      '추적아이디',
      '파일사이즈',
      '현장아이디',
      '비밀번호솔트',
      '사용자아이디',
      '안전보건대책',
      '유해위험요인',
      '결재소스아이디',
      '사업자등록번호',
      '작업종류아이디',
      '코드그룹아이디',
      '파일문서아이디',
      '알림템플릿아이디',
      '파일업로드아이디',
      '이메일템플릿아이디',
      '이행평가 항목명',
      '적용 범위',
      '파일 아이디',
      'IP주소',
      'JSONB',
      'sms 요청아이디',
      'SR아이디',
      'URL',
      '속성값_v1000',
      '명_V2000',
      '명_V500'
  );
