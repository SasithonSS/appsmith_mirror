import React from "react";
import styled from "styled-components";

const Container = styled.div`
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  p {
    font-size: 30px;
    color: #4c5664;
  }
`;

const PageLeftPane = () => {
  return (
    <Container>
      <p>Page</p>
    </Container>
  );
};

export default PageLeftPane;