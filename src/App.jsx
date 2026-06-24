import { BracketProvider } from './store/BracketContext';
import MainLayout from './components/MainLayout';
import { MotionConfig } from 'framer-motion';

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BracketProvider>
        <MainLayout />
      </BracketProvider>
    </MotionConfig>
  )
}

export default App
