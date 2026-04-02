import test from 'node:test';
import assert from 'node:assert/strict';
import { SectionPreviewCache } from '../../src/lib/markdown-section-preview-cache.js';

// --- DOC-02: Section HTML 캐시 (증분 프리뷰) ---

test.describe('SectionPreviewCache', () => {
  test('초기 호출 시 모든 section을 렌더링하여 캐시를 채운다', () => {
    const cache = new SectionPreviewCache();
    const order = ['root', 'intro', 'api'];
    cache.updateSectionOrder(order);

    // 모든 section 에 HTML 저장
    cache.setHtml('root', '<p>root content</p>');
    cache.setHtml('intro', '<h1>Intro</h1>');
    cache.setHtml('api', '<h2>API</h2>');

    // 모든 section 캐시에 존재
    assert.equal(cache.getHtml('root'), '<p>root content</p>');
    assert.equal(cache.getHtml('intro'), '<h1>Intro</h1>');
    assert.equal(cache.getHtml('api'), '<h2>API</h2>');
    assert.deepEqual(cache.getSectionOrder(), ['root', 'intro', 'api']);
  });

  test('변경된 sectionId만 재렌더링되고 다른 section 캐시는 유지된다', () => {
    const cache = new SectionPreviewCache();
    cache.updateSectionOrder(['root', 'intro', 'api']);
    cache.setHtml('root', '<p>root</p>');
    cache.setHtml('intro', '<h1>Intro</h1>');
    cache.setHtml('api', '<h2>API</h2>');

    // 'api' section 만 갱신
    cache.setHtml('api', '<h2>API v2</h2>');

    // 다른 section 은 캐시 유지
    assert.equal(cache.getHtml('root'), '<p>root</p>');
    assert.equal(cache.getHtml('intro'), '<h1>Intro</h1>');
    // 변경된 section 은 갱신됨
    assert.equal(cache.getHtml('api'), '<h2>API v2</h2>');
  });

  test('section 순서가 변경되면 전체 재렌더링 fallback을 수행한다', () => {
    const cache = new SectionPreviewCache();
    cache.updateSectionOrder(['a', 'b', 'c']);
    cache.setHtml('a', '<p>a</p>');
    cache.setHtml('b', '<p>b</p>');
    cache.setHtml('c', '<p>c</p>');

    // 순서 변경 감지
    const changed = cache.updateSectionOrder(['a', 'c', 'b']);
    assert.equal(changed, true);

    // invalidateAll 호출 후 캐시가 비어야 한다
    cache.invalidateAll();
    assert.equal(cache.getHtml('a'), undefined);
    assert.equal(cache.getHtml('b'), undefined);
    assert.equal(cache.getHtml('c'), undefined);
  });

  test('캐시된 HTML을 section 순서대로 조합하여 반환한다', () => {
    const cache = new SectionPreviewCache();
    cache.updateSectionOrder(['root', 'intro', 'api']);
    cache.setHtml('root', '<p>root</p>');
    cache.setHtml('intro', '<h1>Intro</h1>');
    cache.setHtml('api', '<h2>API</h2>');

    const full = cache.buildFullHtml();
    assert.equal(full, '<p>root</p><h1>Intro</h1><h2>API</h2>');
  });

  test('section 삭제 시 해당 section HTML이 결과에서 제거된다', () => {
    const cache = new SectionPreviewCache();
    cache.updateSectionOrder(['a', 'b', 'c']);
    cache.setHtml('a', '<p>a</p>');
    cache.setHtml('b', '<p>b</p>');
    cache.setHtml('c', '<p>c</p>');

    // b 가 삭제된 새 순서
    const changed = cache.updateSectionOrder(['a', 'c']);
    assert.equal(changed, true);

    // 새 순서로 buildFullHtml — b 는 순서에 없으므로 제거
    const full = cache.buildFullHtml();
    assert.equal(full, '<p>a</p><p>c</p>');
  });

  test('updateSectionOrder가 동일 순서이면 false를 반환한다', () => {
    const cache = new SectionPreviewCache();
    cache.updateSectionOrder(['a', 'b']);
    const changed = cache.updateSectionOrder(['a', 'b']);
    assert.equal(changed, false);
  });

  test('캐시가 비어있는 section은 빈 문자열로 처리된다', () => {
    const cache = new SectionPreviewCache();
    cache.updateSectionOrder(['a', 'b']);
    cache.setHtml('a', '<p>a</p>');
    // b 는 캐시 없음
    const full = cache.buildFullHtml();
    assert.equal(full, '<p>a</p>');
  });
});
