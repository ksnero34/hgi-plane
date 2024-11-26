export function isFileValid(file: File, showAlert = true): boolean {
  if (!file) {
    if (showAlert) {
      alert("No file selected. Please select a file to upload.");
    }
    return false;
  }

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    if (showAlert) {
      alert("Invalid file type. Please select a JPEG, JPG, PNG, or WEBP image file.");
    }
    return false;
  }

  if (file.size > 50 * 1024 * 1024) {
    if (showAlert) {
      alert("File size too large. Please select a file smaller than 50MB.");
    }
    return false;
  }

  return true;
}
