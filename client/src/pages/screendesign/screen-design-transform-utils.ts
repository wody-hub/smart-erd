/**
 * Konva transform scale 값으로부터 화면기획 인스턴스의 다음 크기를 계산한다.
 *
 * flip 상황에서도 음수 scale 부호는 무시하고 실제 크기만 반영한다.
 *
 * @param params 현재 인스턴스 크기와 transform scale 값
 * @returns transform 적용 후 width/height
 */
export function resolveScreenDesignTransformedSize(params: {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}): {
  width: number;
  height: number;
} {
  return {
    width: params.width * Math.abs(params.scaleX),
    height: params.height * Math.abs(params.scaleY),
  };
}
