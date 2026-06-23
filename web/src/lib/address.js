export const emptyAddress = {
  line1: "",
  line2: "",
  locality: "",
  city: "",
  state: "",
  pincode: "",
};

export function addressIsComplete(value, lookup) {
  return (
    value.line1.trim() !== "" &&
    value.locality.trim() !== "" &&
    value.city.trim() !== "" &&
    value.state.trim() !== "" &&
    value.pincode.length === 6 &&
    lookup?.pincode === value.pincode
  );
}
