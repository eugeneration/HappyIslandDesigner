// // Context.js

// import React, { useReducer } from "react";

// interface ModalAction {
//   type: string,

// }

// let reducer = (state, action: ModalAction) => {
//   switch (action.type) {
//     case "open":
//       return { ...state, :  };
//     case "close":
//       return { ...state, :  };
//     default:
//       return;
//   }
// };
// const initialState = {
//   component: null,
//   props: {},
//   showModal: () => {},
//   hideModal: () => {},
// }
// const CounterContext = React.createContext(initialState);
// function CounterProvider(props) {
//   const [state, dispatch] = useReducer(reducer, initialState);
//   return (
//    <CounterContext.Provider value={{ state, dispatch }}>
//       {props.children}
//     </CounterContext.Provider>
//   );
// }
// export { ModalContext, ModalProvider };
