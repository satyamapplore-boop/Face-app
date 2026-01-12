export type FaceRegion = {
  id: string;
  label: string;
  color: string;
  polygons: number[][];
};

export const faceRegions: FaceRegion[] = [
  {
    id: "forehead",
    label: "Forehead",
    color: "rgba(16, 185, 129, 0.28)",
    polygons: [[10, 338, 297, 332, 284, 251, 389, 356, 9, 107, 66, 105]],
  },
  {
    id: "left-cheek",
    label: "Left cheek",
    color: "rgba(59, 130, 246, 0.25)",
    polygons: [[234, 93, 132, 58, 172, 136, 150, 149, 170, 169]],
  },
  {
    id: "right-cheek",
    label: "Right cheek",
    color: "rgba(236, 72, 153, 0.25)",
    polygons: [[454, 323, 361, 288, 397, 365, 379, 378, 400, 401]],
  },
  {
    id: "nose",
    label: "Nose",
    color: "rgba(250, 204, 21, 0.3)",
    polygons: [[1, 2, 98, 327, 168, 197, 5, 4]],
  },
  {
    id: "chin",
    label: "Chin",
    color: "rgba(148, 163, 184, 0.28)",
    polygons: [
      [
        152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389,
        251, 284, 332, 297, 338, 10, 109, 67, 103, 54, 21, 162, 127, 234, 93,
        132, 58, 172, 136, 150, 149, 176, 148,
      ],
    ],
  },
  {
    id: "peri-ocular",
    label: "Peri-ocular",
    color: "rgba(45, 212, 191, 0.25)",
    polygons: [
      [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
      [
        263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387,
        388, 466,
      ],
    ],
  },
];
