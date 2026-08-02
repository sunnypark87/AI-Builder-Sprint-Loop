export function isExpectedPledgeVersion(
  suppliedVersion: unknown,
  existingVersion: number,
) {
  return (
    suppliedVersion === undefined ||
    (Number.isInteger(suppliedVersion) && suppliedVersion === existingVersion)
  );
}
