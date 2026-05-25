declare module 'react-native-actioncable' {
  const ActionCable: {
    createConsumer: (url: string) => unknown;
  };
  export default ActionCable;
}
