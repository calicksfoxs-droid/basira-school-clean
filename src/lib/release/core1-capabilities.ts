export const CORE1_CAPABILITIES = {
  legacyNewAuthoring: false,
  manualGrading: false,
  objectiveOnlyAssessment: true,
  lessonAidAsset: false,
  imageHandout: false,
} as const;

export const CORE1_QUIZ_QUESTION_TYPES = ["mcq", "true_false"] as const;
export const CORE1_ASSET_KINDS = ["video", "handout"] as const;
export const CORE1_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const;
export const CORE1_HANDOUT_MIME_TYPES = ["application/pdf"] as const;

export const CORE1_DISABLED_MESSAGE = "هذه الإمكانية ليست ضمن Basira Core 1.0";
