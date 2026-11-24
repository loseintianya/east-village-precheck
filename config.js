/**
 * East Village Move-In Pre-Check & Key Handoff Web App
 * 团队默认配置（部署静态网页前可在此填写，填写后手机打开即自动生效，也可在网页右上角「设置」中覆盖）
 */
window.EV_APP_CONFIG = {
  // 部署完 Google Apps Script 后，将生成的 Web App URL 粘贴到这里
  // 例如: "https://script.google.com/macros/s/AKfycb.../exec"
  GAS_WEB_APP_URL: "",

  // 访问口令（与 Google Apps Script 中 ACCESS_PIN 一致；如不设口令留空即可）
  ACCESS_PIN: "",

  // 第 4 页「36-Hour Supplement Email」默认接收邮箱（如 leasing@burlewgroup.com）
  DEFAULT_SUBMISSION_EMAIL: "",

  // 默认检查员 / 管理员姓名（可选）
  DEFAULT_STAFF_NAME: "",

  // 图片压缩参数（保证手机上传速度快、PDF 清晰且体积适中）
  PHOTO_MAX_DIMENSION: 1500,
  PHOTO_JPEG_QUALITY: 0.82
};
