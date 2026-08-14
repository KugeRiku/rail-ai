export type TripDetailStopTime = {
  stopId: string;
  stopName: string;
  stopSequence: number;
  arrivalSeconds: number;
  departureSeconds: number;
  arrivalTime: string;
  departureTime: string;
  shapeDistance: number | null;
  latitude: number;
  longitude: number;
};

export type TripDetail = {
  trip: {
    id: string;
    serviceId: string;
    shapeId: string;
    headsign: string;
    directionId: number;
  };
  route: {
    id: string;
    shortName: string;
    name: string;
    color: string;
  };
  stopTimes: TripDetailStopTime[];
};
