type ProfileImagePickerDependencies = {
  isNativePickerAvailable: () => boolean;
  pickNativeImageFiles: (limit: number) => Promise<File[] | null>;
  openFallback: () => void;
};

export async function selectProfileImage({
  isNativePickerAvailable,
  pickNativeImageFiles,
  openFallback,
}: ProfileImagePickerDependencies): Promise<File | null> {
  if (!isNativePickerAvailable()) {
    openFallback();
    return null;
  }

  const files = await pickNativeImageFiles(1);
  return files?.[0] ?? null;
}
