import '../Sass/index.scss'
interface PropType {
    size: number;
}

const Loading = ({ size }: PropType) => {
    return (
        <div
            id="loading"
            style={{
                width: size,
                height: size,
            }}
        />
    );
};

export default Loading;