/**
 * Section HTML 캐시 자료구조.
 * section ID -> sanitized HTML 맵과 현재 section 순서를 유지한다.
 *
 * 증분 프리뷰에서 변경된 section만 Worker에 재렌더링 요청하고,
 * 나머지 section은 캐시된 HTML을 유지하는 전략의 핵심 데이터 구조이다.
 */
export class SectionPreviewCache {
  /** section ID -> sanitized HTML */
  private readonly htmlCache = new Map<string, string>();
  /** 현재 section 순서 */
  private sectionOrder: string[] = [];

  /**
   * 현재 section 순서를 반환한다.
   *
   * @returns section ID 배열 (순서 보장)
   */
  getSectionOrder(): string[] {
    return [...this.sectionOrder];
  }

  /**
   * section 순서를 갱신한다.
   * 순서가 변경되면 true를 반환하고, 더 이상 존재하지 않는 section의
   * HTML 캐시를 자동 정리(GC)한다.
   *
   * @param newOrder 새 section ID 배열
   * @returns 순서 변경 여부
   */
  updateSectionOrder(newOrder: string[]): boolean {
    const changed =
      newOrder.length !== this.sectionOrder.length ||
      newOrder.some((id, i) => id !== this.sectionOrder[i]);
    if (changed) {
      this.sectionOrder = [...newOrder];
      // GC: 현재 문서에 없는 section ID의 stale 캐시 정리
      const activeIds = new Set(newOrder);
      for (const cachedId of this.htmlCache.keys()) {
        if (!activeIds.has(cachedId)) {
          this.htmlCache.delete(cachedId);
        }
      }
    }
    return changed;
  }

  /**
   * section HTML을 캐시에 저장한다.
   *
   * @param sectionId section ID
   * @param html sanitized HTML
   */
  setHtml(sectionId: string, html: string): void {
    this.htmlCache.set(sectionId, html);
  }

  /**
   * section HTML을 캐시에서 조회한다.
   *
   * @param sectionId section ID
   * @returns 캐시된 HTML (없으면 undefined)
   */
  getHtml(sectionId: string): string | undefined {
    return this.htmlCache.get(sectionId);
  }

  /**
   * 전체 캐시를 무효화한다.
   */
  invalidateAll(): void {
    this.htmlCache.clear();
  }

  /**
   * 현재 section 순서대로 HTML을 조합하여 반환한다.
   * 캐시가 비어 있는 section은 빈 문자열로 처리한다.
   *
   * @returns 전체 프리뷰 HTML
   */
  buildFullHtml(): string {
    return this.sectionOrder.map((id) => this.htmlCache.get(id) ?? '').join('');
  }
}
