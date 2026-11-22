// TODO: Remove the fallback when the last v1 reader is retired; it still reads "name".
export const label = row => row.label ?? row.name;
