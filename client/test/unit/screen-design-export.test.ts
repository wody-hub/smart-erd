import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScreenDesignPdfFilename,
  buildScreenDesignPngFilename,
  getScreenDesignPdfPageLayout,
  sanitizeScreenDesignExportSegment,
} from '../../src/pages/screendesign/screen-design-export.js';

test('sanitizeScreenDesignExportSegment 는 파일명에 쓸 수 없는 문자를 제거한다', () => {
  assert.equal(
    sanitizeScreenDesignExportSegment('  Admin:/Users?*  ', 'fallback'),
    'Admin--Users--',
  );
  assert.equal(sanitizeScreenDesignExportSegment('   ', 'fallback'), 'fallback');
});

test('buildScreenDesignPngFilename 는 문서명과 화면명을 조합한다', () => {
  assert.equal(
    buildScreenDesignPngFilename('Service Console', 'Login Screen'),
    'Service Console-Login Screen.png',
  );
});

test('buildScreenDesignPdfFilename 는 빈 이름일 때 fallback 을 사용한다', () => {
  assert.equal(buildScreenDesignPdfFilename('   '), 'screen-spec.pdf');
});

test('getScreenDesignPdfPageLayout 는 화면 비율에 맞는 방향을 계산한다', () => {
  assert.deepEqual(getScreenDesignPdfPageLayout({ width: 1440, height: 900 }), {
    pageWidth: 1440,
    pageHeight: 900,
    orientation: 'landscape',
  });
  assert.deepEqual(getScreenDesignPdfPageLayout({ width: 375, height: 812 }), {
    pageWidth: 375,
    pageHeight: 812,
    orientation: 'portrait',
  });
});
