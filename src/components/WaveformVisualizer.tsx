const WaveformVisualizer = ({ isPlaying }: { isPlaying: boolean }) => {
  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-primary transition-all duration-300"
          style={{
            height: isPlaying ? undefined : '8px',
            animation: isPlaying
              ? `waveform 0.8s ease-in-out ${i * 0.05}s infinite`
              : 'none',
            minHeight: '4px',
            maxHeight: '28px',
          }}
        />
      ))}
    </div>
  );
};

export default WaveformVisualizer;
