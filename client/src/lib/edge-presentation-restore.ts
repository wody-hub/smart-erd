import type { EdgeRoutingType, Waypoint } from '../types/erd.js';
import type { EdgeHandleSide } from '../types/erd.js';

interface ResolvePreservedWaypointsInput {
  routingType: EdgeRoutingType;
  previousSourceHandle?: string;
  previousTargetHandle?: string;
  nextSourceHandle: string;
  nextTargetHandle: string;
  previousSourceSide?: EdgeHandleSide;
  previousTargetSide?: EdgeHandleSide;
  nextSourceSide?: EdgeHandleSide;
  nextTargetSide?: EdgeHandleSide;
  waypoints?: Waypoint[];
}

export function resolvePreservedWaypoints(
  input: ResolvePreservedWaypointsInput,
): Waypoint[] | undefined {
  if (input.routingType !== 'straight') {
    return undefined;
  }

  const sameHandles =
    input.previousSourceHandle === input.nextSourceHandle &&
    input.previousTargetHandle === input.nextTargetHandle;
  if (sameHandles) {
    return input.waypoints;
  }

  const sameSides =
    input.previousSourceSide != null &&
    input.previousTargetSide != null &&
    input.nextSourceSide != null &&
    input.nextTargetSide != null &&
    input.previousSourceSide === input.nextSourceSide &&
    input.previousTargetSide === input.nextTargetSide;

  return sameSides ? input.waypoints : undefined;
}
